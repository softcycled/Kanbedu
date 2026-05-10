"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Task, Board } from "@/lib/types";
import BoardComp from "./Board";
import Sidebar, { Panel } from "./Sidebar";
import AnalyticsPanel from "./AnalyticsPanel";
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
  // Incremented every time the user navigates to the analytics panel so it always fetches fresh data.
  const analyticsKey = useRef(0);
  const [analyticsRenderKey, setAnalyticsRenderKey] = useState(0);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Sync state with server props (triggered by router.refresh())
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setBoards(initialBoards);
  }, [initialBoards]);

  const handleRefresh = useCallback(async () => {
    console.log("BoardContainer: 🔄 Remote change detected, forcing refresh...");
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${activeBoardId}&_t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${activeBoardId}&_t=${Date.now()}`, { cache: "no-store" })
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (columnsRes.ok) setColumns(await columnsRes.json());
  }, [activeBoardId]);

  const { broadcastRefresh } = useRealtime(activeBoardId, handleRefresh);

  const handlePanelChange = useCallback((panel: Panel) => {
    if (panel === "analytics") {
      analyticsKey.current += 1;
      setAnalyticsRenderKey(analyticsKey.current);
    }
    setActivePanel(panel);
  }, []);

  const handleBoardSwitch = useCallback(async (boardId: string) => {
    // Fetch tasks and columns for the new board before switching
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${boardId}&_t=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${boardId}&_t=${Date.now()}`, { cache: "no-store" })
    ]);
    const newTasks = tasksRes.ok ? await tasksRes.json() : [];
    const newColumns = columnsRes.ok ? await columnsRes.json() : [];
    
    // Batch: both updates apply in same render so Board remounts with correct data
    setActiveBoardId(boardId);
    setTasks(newTasks);
    setColumns(newColumns);
    setActivePanel("board");
  }, []);

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
        onSupportClick={() => setIsSupportOpen(true)}
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
