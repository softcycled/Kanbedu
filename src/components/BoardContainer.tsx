"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Task, Board } from "@/lib/types";
import BoardComp from "./Board";
import Sidebar, { Panel, ClassSummary } from "./Sidebar";
import StudentClassView from "./class/StudentClassView";
import dynamic from "next/dynamic";
const AnalyticsPanel = dynamic(() => import("./AnalyticsPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-8 space-y-4" aria-hidden>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
    </div>
  ),
});
import SettingsPanel from "./SettingsPanel";
import ClientErrorBoundary from "./ClientErrorBoundary";
import ProfilePanel from "./ProfilePanel";
import HelpPanel from "./HelpPanel";
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
  // When a student deep-links to /?class=<id>, the group board is resolved
  // server-side and passed here so the class view paints without a flicker.
  initialClass?: ClassSummary | null;
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
  initialClass = null,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [columns, setColumns] = useState<ColumnData[]>(initialColumns);
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId);
  const [activePanel, setActivePanel] = useState<Panel>("board");
  const analyticsKey = useRef(0);
  const [analyticsRenderKey, setAnalyticsRenderKey] = useState(0);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);

  // Classes are owned here (single source of truth) so the sidebar list and the
  // lobby poll read the same data. A student's selected class renders in the
  // main content area; educators/TAs are routed to the dedicated workspace.
  const [classes, setClasses] = useState<ClassSummary[]>(initialClass ? [initialClass] : []);
  const [activeClass, setActiveClass] = useState<ClassSummary | null>(initialClass);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes", { cache: "no-store" });
      if (res.ok) {
        const data: ClassSummary[] = await res.json();
        setClasses(data);
        return data;
      }
    } catch {
      /* ignore — Classes section just stays as-is */
    }
    return null;
  }, []);

  // Load the user's classes once on mount for the sidebar Classes section.
  useEffect(() => { loadClasses(); }, [loadClasses]);

  // Lobby poll: while a student is viewing a class but hasn't been placed into a
  // group yet, re-check every ~10s. The moment their row gains a boardId, swap
  // activeClass so the group board appears on its own — no manual reload.
  useEffect(() => {
    if (!activeClass || activeClass.boardId) return;
    const interval = setInterval(async () => {
      const data = await loadClasses();
      if (!data) return;
      const updated = data.find((c) => c.id === activeClass.id);
      if (updated?.boardId) setActiveClass(updated);
    }, 10_000);
    return () => clearInterval(interval);
  }, [activeClass, loadClasses]);

  // Per-board cache: boardId maps to { tasks, columns, fetchedAt }
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

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  const handleRefresh = useCallback(async (payload?: any) => {
    const boardId = activeBoardIdRef.current;

    if (payload?.task) {
      const t = payload.task;
      setTasks((prev) => {
        const exists = prev.some((p) => p.id === t.id);
        if (exists) return prev.map((p) => (p.id === t.id ? { ...p, ...t } : p));
        const hasColumn = columnsRef.current.some((c) => c.id === t.column);
        if (!hasColumn) return prev;
        return [...prev, t].sort((a, b) => {
          if (a.column !== b.column) return a.column < b.column ? -1 : 1;
          return (a.order ?? 0) - (b.order ?? 0);
        });
      });
      return;
    }

    if (payload?.taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
      return;
    }

    // Fallback: full board fetch (column changes, etc.)
    const data = await fetchBoardData(boardId);
    if (activeBoardIdRef.current === boardId) {
      setTasks(data.tasks);
      setColumns(data.columns);
    }
  }, [fetchBoardData]);

  useRealtime(activeBoard?.realtimeSecret ?? null, handleRefresh);

  // Escape closes any open panel and returns to the board view.
  // Skips when the user is typing so form inputs can catch it first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activePanel === "board") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      setActivePanel("board");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel]);

  const handlePanelChange = useCallback((panel: Panel) => {
    if (panel === "analytics") {
      analyticsKey.current += 1;
      setAnalyticsRenderKey(analyticsKey.current);
    }
    setActiveClass(null); // leaving the class view for a personal panel
    setActivePanel(panel);
  }, []);

  // Selecting a class: educators/TAs go to the dedicated workspace; students
  // open their group board inside this shell.
  const handleClassSelect = useCallback((c: ClassSummary) => {
    if (c.role === "educator" || c.role === "ta") {
      router.push(`/class/${c.id}`);
      return;
    }
    setActivePanel("board");
    setActiveClass(c);
  }, [router]);

  // Student leaves a class from within the shell: remove it server-side, then
  // drop it from the list and fall back to the personal board.
  const handleLeaveClass = useCallback(async (classId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/classes/${classId}/members`, { method: "DELETE" });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setActiveClass(null);
    setActivePanel("board");
    return true;
  }, []);

  const handleBoardSwitch = useCallback(async (boardId: string) => {
    setActiveClass(null); // switching to a personal board leaves the class view
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

    if (!cached) {
      // No cache: switch board ID immediately so the header and key update before the fetch
      setActiveBoardId(boardId);
      activeBoardIdRef.current = boardId; // keep ref in sync so the guard below passes
      setActivePanel("board");
    }

    if (isStale) {
      // Fetch fresh data (silently if we already rendered from cache)
      setIsLoadingBoard(true);
      const data = await fetchBoardData(boardId);
      boardCache.current.set(boardId, { ...data, fetchedAt: Date.now() });
      // Only update if the user hasn't switched away again
      if (activeBoardIdRef.current === boardId) {
        setTasks(data.tasks);
        setColumns(data.columns);
      }
      setIsLoadingBoard(false);
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

  const handleJoinBoard = useCallback(async (inviteInput: string) => {
    const extractToken = (s: string) => {
      try {
        const u = new URL(s);
        const parts = u.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("invite");
        if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
        return parts[parts.length - 1] || s;
      } catch {
        const parts = s.split('/').filter(Boolean);
        const idx = parts.indexOf('invite');
        if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
        return s;
      }
    };

    const token = extractToken(inviteInput.trim());
    if (!token) throw new Error('Invalid invite token');

    const res = await fetch(`/api/invites/${token}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'Failed to join board');
    }

    // Response includes boardId on success (or if already a member)
    const joinedBoardId = body.boardId as string | undefined;

    // Refresh boards list and switch to the joined board
    const boardsRes = await fetch('/api/boards', { cache: 'no-store' });
    if (boardsRes.ok) {
      const newBoards: Board[] = await boardsRes.json();
      setBoards(newBoards);
      if (joinedBoardId) {
        await handleBoardSwitch(joinedBoardId);
      }
    }

    return body;
  }, [handleBoardSwitch]);

  const handleUpdateBoard = useCallback(async (boardId: string, data: { name?: string }) => {
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


  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        boards={boards}
        activeBoardId={activeBoardId}
        activePanel={activePanel}
        classes={classes}
        activeClassId={activeClass?.id ?? null}
        onClassSelect={handleClassSelect}
        onClassesReload={loadClasses}
        onPanelChange={handlePanelChange}
        onBoardSwitch={handleBoardSwitch}
        onCreateBoard={handleCreateBoard}
        onJoinBoard={handleJoinBoard}
        onReorder={handleReorderBoards}
        onBoardHover={prefetchBoard}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeClass && (
          <main className="flex-1 pb-16 md:pb-0 overflow-hidden flex flex-col">
            <StudentClassView activeClass={activeClass} currentUserId={currentUserId} onLeave={handleLeaveClass} />
          </main>
        )}
        {!activeClass && activePanel === "board" && (
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
                isLoading={isLoadingBoard}
                currentUserId={currentUserId}
              />
            </main>
          </>
        )}
        {activePanel === "analytics" && (
          <ClientErrorBoundary
            fallback={<div className="flex-1 flex items-center justify-center text-muted text-sm">Failed to load analytics. <button onClick={() => setActivePanel("board")} className="ml-3 text-xs underline">Back</button></div>}
          >
            <AnalyticsPanel key={analyticsRenderKey} boardName={activeBoard?.name ?? ""} boardId={activeBoardId} />
          </ClientErrorBoundary>
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
        {activePanel === "help" && <HelpPanel />}
      </div>
    </div>
  );
}
