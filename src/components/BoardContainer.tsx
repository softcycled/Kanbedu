"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Task, Board } from "@/lib/types";
import BoardComp from "./Board";
import Sidebar, { Panel } from "./Sidebar";
import dynamic from "next/dynamic";
const AnalyticsPanel = dynamic(() => import("./AnalyticsPanel"), { ssr: false, loading: () => <div /> });
import SettingsPanel from "./SettingsPanel";
import ProfilePanel from "./ProfilePanel";
import SupportModal from "./SupportModal";
import AdminPanel from "./AdminPanel";
import { useRealtime } from "@/hooks/useRealtime";
import { ColumnData } from "@/lib/types";

interface Props {
  initialTasks: Task[];
  initialBoards: Board[];
  initialBoardId: string;
  initialColumns: import("@/lib/types").ColumnData[];
  currentUserId: string;
  isAdmin?: boolean;
}

interface BoardCache {
  tasks: Task[];
  columns: ColumnData[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 s — stale boards refresh silently in background

export default function BoardContainer({
  initialTasks,
  initialBoards,
  initialBoardId,
  initialColumns,
  currentUserId,
  isAdmin = false,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [columns, setColumns] = useState<ColumnData[]>(initialColumns);
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId);
  const [activePanel, setActivePanel] = useState<Panel>("board");
  const analyticsKey = useRef(0);
  const [analyticsRenderKey, setAnalyticsRenderKey] = useState(0);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Per-board cache: boardId → { tasks, columns, fetchedAt }
  const boardCache = useRef<Map<string, BoardCache>>(
    new Map([
      [initialBoardId, { tasks: initialTasks, columns: initialColumns, fetchedAt: Date.now() }],
    ])
  );

  // Keep the cache entry for the active board in sync with live state
  useEffect(() => {
    boardCache.current.set(activeBoardId, { tasks, columns, fetchedAt: Date.now() });
  }, [tasks, columns, activeBoardId]);

  // activeBoardId ref for use inside callbacks that would otherwise have stale closures
  const activeBoardIdRef = useRef(activeBoardId);
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);

  // Sync state with server props on initial hydration only
  useEffect(() => { setBoards(initialBoards); }, [initialBoards]);

  const fetchBoardData = useCallback(async (boardId: string) => {
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${boardId}`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${boardId}`, { cache: "no-store" }),
    ]);
    const newTasks = tasksRes.ok ? await tasksRes.json() : [];
    const newColumns = columnsRes.ok ? await columnsRes.json() : [];
    return { tasks: newTasks, columns: newColumns };
  }, []);

  // Realtime refresh: surgically update only the active board
  // Keep a columns ref so the refresh handler can make lightweight decisions
  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);

  const handleRefresh = useCallback(async (payload?: any) => {
    const boardId = activeBoardIdRef.current;
    // If other clients broadcasted a patch with the changed task, apply it surgically
    if (payload && payload.task) {
      const t = payload.task;
      setTasks((prev) => {
        const exists = prev.some((p) => p.id === t.id);
        // If task exists, patch it; otherwise append only if its column belongs to this board
        if (exists) return prev.map((p) => (p.id === t.id ? { ...p, ...t } : p));
        const hasColumn = columnsRef.current.some((c) => c.id === t.column);
        if (!hasColumn) return prev;
        return [...prev, t];
      });
      return;
    }

    // Fallback: full board fetch
    const data = await fetchBoardData(boardId);
    // Only apply if still on the same board
    if (activeBoardIdRef.current === boardId) {
      setTasks(data.tasks);
      setColumns(data.columns);
    }
  }, [fetchBoardData]);

  const { broadcastRefresh } = useRealtime(activeBoardId, handleRefresh);

  const handlePanelChange = useCallback((panel: Panel) => {
    if (panel === "analytics") {
      analyticsKey.current += 1;
      setAnalyticsRenderKey(analyticsKey.current);
    }
    setActivePanel(panel);
  }, []);

  const handleBoardSwitch = useCallback(async (boardId: string) => {
    if (boardId === activeBoardIdRef.current) return;

    const cached = boardCache.current.get(boardId);
    const isStale = !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS;

    if (cached) {
      // Render immediately from cache for instant perceived switch
      setActiveBoardId(boardId);
      setTasks(cached.tasks);
      setColumns(cached.columns);
      setActivePanel("board");
    }

    if (isStale) {
      // Fetch fresh data (silently if we already rendered from cache)
      const data = await fetchBoardData(boardId);
      boardCache.current.set(boardId, { ...data, fetchedAt: Date.now() });
      // Only update if the user hasn't switched away again
      if (activeBoardIdRef.current === boardId) {
        setTasks(data.tasks);
        setColumns(data.columns);
      }
    }

    if (!cached) {
      setActivePanel("board");
    }
  }, [fetchBoardData]);

  // Prefetch adjacent boards so switching feels instant
  const prefetchBoard = useCallback(async (boardId: string) => {
    if (boardCache.current.has(boardId)) return;
    const data = await fetchBoardData(boardId);
    boardCache.current.set(boardId, { ...data, fetchedAt: Date.now() });
  }, [fetchBoardData]);

  const handleCreateBoard = useCallback(async (name: string) => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const board: Board = await res.json();
    setBoards((prev) => [...prev, board]);
    await handleBoardSwitch(board.id);
  }, [handleBoardSwitch]);

  const handleUpdateBoard = useCallback(async (boardId: string, data: { name?: string; githubRepo?: string | null }) => {
    const res = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const updated: Board = await res.json();
    setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)));
  }, []);

  const handleDeleteBoard = useCallback(async (boardId: string) => {
    if (boards.length === 1) return;
    const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (!res.ok) return;
    boardCache.current.delete(boardId);
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      await handleBoardSwitch(remaining[0].id);
    }
  }, [boards, activeBoardId, handleBoardSwitch]);

  const handleReorderBoards = useCallback(async (ids: string[]) => {
    const res = await fetch("/api/boards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    setBoards((prev) => {
      const map = new Map(prev.map((b) => [b.id, b]));
      return ids.map((id, index) => ({ ...map.get(id)!, order: index }));
    });
  }, []);

  const handleSupportClick = useCallback(() => setIsSupportOpen(true), []);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        boards={boards}
        activeBoardId={activeBoardId}
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
        onBoardSwitch={handleBoardSwitch}
        onCreateBoard={handleCreateBoard}
        onReorder={handleReorderBoards}
        onSupportClick={handleSupportClick}
        onBoardHover={prefetchBoard}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activePanel === "board" && (
          <>
            <main className="flex-1 pb-16 md:pb-0 overflow-hidden flex flex-col">
              <BoardComp
                key={activeBoardId}
                boardId={activeBoardId}
                boardName={activeBoard?.name ?? ""}
                tasks={tasks}
                columns={columns}
                onTasksChange={setTasks}
                onColumnsChange={setColumns}
                broadcastRefresh={broadcastRefresh}
                currentUserId={currentUserId}
              />
            </main>
          </>
        )}
        {activePanel === "analytics" && (
          <AnalyticsPanel key={analyticsRenderKey} boardName={activeBoard?.name ?? ""} boardId={activeBoardId} />
        )}
        {activePanel === "settings" && (
          <SettingsPanel
            boards={boards}
            activeBoardId={activeBoardId}
            onUpdateBoard={handleUpdateBoard}
            onDelete={handleDeleteBoard}
            onReorder={handleReorderBoards}
            currentUserId={currentUserId}
          />
        )}
        {activePanel === "profile" && <ProfilePanel />}
        {activePanel === "admin" && <AdminPanel />}
      </div>

      <SupportModal 
        isOpen={isSupportOpen} 
        onClose={() => setIsSupportOpen(false)} 
      />
    </div>
  );
}
