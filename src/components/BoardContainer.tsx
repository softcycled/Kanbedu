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
import AnnouncementModal from "./AnnouncementModal";
import { useRealtime } from "@/hooks/useRealtime";
import { ColumnData } from "@/lib/types";
import { trackEvent } from "@/lib/analytics";

interface Props {
  initialTasks: Task[];
  initialBoards: Board[];
  initialBoardId: string;
  initialColumns: import("@/lib/types").ColumnData[];
  currentUserId: string;
  isAdmin?: boolean;
  initialTaskTotal?: number;
  // When a student deep-links to /?class=<id>, the group board is resolved
  // server-side and passed here so the class view paints without a flicker.
  initialClass?: ClassSummary | null;
}

interface BoardCache {
  tasks: Task[];
  columns: ColumnData[];
  fetchedAt: number;
  total: number;
}

const CACHE_TTL_MS = 30_000; // 30 s — stale boards refresh silently in background

export default function BoardContainer({
  initialTasks,
  initialBoards,
  initialBoardId,
  initialColumns,
  currentUserId,
  isAdmin = false,
  initialTaskTotal,
  initialClass = null,
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [columns, setColumns] = useState<ColumnData[]>(initialColumns);
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState(initialBoardId);
  const [activePanel, setActivePanel] = useState<Panel>("board");
  // Set when Settings should open with a specific class board pre-selected
  // (e.g. a student clicking "Board settings" from inside their group board),
  // instead of defaulting to the personal boards list.
  const [pendingClassBoardId, setPendingClassBoardId] = useState<string | null>(null);
  const analyticsKey = useRef(0);
  const [analyticsRenderKey, setAnalyticsRenderKey] = useState(0);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [taskTotal, setTaskTotal] = useState(initialTaskTotal ?? initialTasks.length);

  // "board" is the default resting state, not a feature someone chose to
  // open, so it's excluded here; board opens are tracked separately below.
  useEffect(() => {
    if (activePanel === "board") return;
    trackEvent("panel_view", { panel: activePanel, context: "personal" });
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== "board") return;
    trackEvent("board_view", { boardType: "personal" });
  }, [activeBoardId, activePanel]);

  // Mobile drawer: the sidebar is a full-screen base layer; the board (main)
  // slides off to the right to reveal it. Open via the header "<" trigger or a
  // right-swipe; close via a left-swipe or any sidebar selection.
  const [navOpen, setNavOpen] = useState(false);
  const navOpenRef = useRef(navOpen);
  useEffect(() => { navOpenRef.current = navOpen; }, [navOpen]);

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
  // group yet, re-check every ~10s. Pauses when the tab is hidden and resumes
  // immediately when the user returns, so no unnecessary requests fire in the bg.
  useEffect(() => {
    if (!activeClass || activeClass.boardId) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const data = await loadClasses();
      if (!data) return;
      const updated = data.find((c) => c.id === activeClass.id);
      if (updated?.boardId) setActiveClass(updated);
    };

    const start = () => { if (!interval) interval = setInterval(tick, 10_000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => { document.hidden ? stop() : start(); };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [activeClass, loadClasses]);

  // Per-board cache: boardId maps to { tasks, columns, fetchedAt, total }
  const boardCache = useRef<Map<string, BoardCache>>(
    new Map([
      [initialBoardId, { tasks: initialTasks, columns: initialColumns, fetchedAt: Date.now(), total: initialTaskTotal ?? initialTasks.length }],
    ])
  );

  // Keep the cache entry for the active board in sync with live state
  useEffect(() => {
    boardCache.current.set(activeBoardId, { tasks, columns, fetchedAt: Date.now(), total: taskTotal });
  }, [tasks, columns, activeBoardId, taskTotal]);

  // activeBoardId ref for use inside callbacks that would otherwise have stale closures
  const activeBoardIdRef = useRef(activeBoardId);
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);

  // Sync state with server props on initial hydration only
  useEffect(() => { setBoards(initialBoards); }, [initialBoards]);

  const fetchBoardData = useCallback(async (boardId: string, take?: number) => {
    const takePart = take !== undefined ? `&take=${take}` : "";
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${boardId}${takePart}`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${boardId}`, { cache: "no-store" }),
    ]);
    const tasksPayload = tasksRes.ok ? await tasksRes.json() : { tasks: [], total: 0 };
    const newColumns = columnsRes.ok ? await columnsRes.json() : [];
    return {
      tasks: (tasksPayload.tasks ?? []) as Task[],
      columns: newColumns as ColumnData[],
      total: (tasksPayload.total ?? 0) as number,
    };
  }, []);

  // Realtime refresh: surgically update only the active board
  // Keep a columns ref so the refresh handler can make lightweight decisions
  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);

  // Refs so handleRefresh can decide how many tasks to re-fetch without
  // needing tasks/taskTotal in its dependency array (which would re-subscribe realtime).
  const loadedCountRef = useRef(initialTasks.length);
  const taskTotalRef = useRef(initialTaskTotal ?? initialTasks.length);
  useEffect(() => { loadedCountRef.current = tasks.length; }, [tasks]);
  useEffect(() => { taskTotalRef.current = taskTotal; }, [taskTotal]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  const handleRefresh = useCallback(async (payload?: any) => {
    const boardId = activeBoardIdRef.current;

    if (payload?.updates) {
      const updates = payload.updates as { id: string; order: number }[];
      setTasks((prev) => prev.map((t) => {
        const u = updates.find((u) => u.id === t.id);
        return u ? { ...t, order: u.order } : t;
      }));
      return;
    }

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
    // Preserve however many tasks are currently visible so the list doesn't shrink.
    const loaded = loadedCountRef.current;
    const total = taskTotalRef.current;
    const take = loaded >= total ? 0 : Math.max(loaded, 100);
    const data = await fetchBoardData(boardId, take);
    if (activeBoardIdRef.current === boardId) {
      setTasks(data.tasks);
      setColumns(data.columns);
      setTaskTotal(data.total);
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

  // Mobile swipe: right-swipe anywhere opens the nav, left-swipe closes it.
  // To preserve horizontal board-column scrolling, a closed-state gesture is
  // ignored when it begins inside a strip that is scrolled away from its left
  // origin (so the user scrolls columns instead of opening). Vertical-dominant
  // swipes are ignored so normal scrolling is unaffected.
  useEffect(() => {
    const THRESHOLD = 60;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const startsInScrolledStrip = (target: EventTarget | null): boolean => {
      let node = target as HTMLElement | null;
      while (node && node !== document.body) {
        if (node.scrollLeft > 0 && node.scrollWidth > node.clientWidth) {
          const overflowX = getComputedStyle(node).overflowX;
          if (overflowX === "auto" || overflowX === "scroll") return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !window.matchMedia("(max-width: 767px)").matches) { tracking = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = navOpenRef.current || !startsInScrolledStrip(e.target);
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
      if (dx > 0 && !navOpenRef.current) setNavOpen(true);
      else if (dx < 0 && navOpenRef.current) setNavOpen(false);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  const handlePanelChange = useCallback((panel: Panel) => {
    if (panel === "analytics") {
      analyticsKey.current += 1;
      setAnalyticsRenderKey(analyticsKey.current);
    }
    setPendingClassBoardId(null); // clear any pending class-board preselect from a prior "Board settings" jump
    setActiveClass(null); // leaving the class view for a personal panel
    setActivePanel(panel);
  }, []);

  // Stable reference so AnalyticsPanel's React.memo isn't defeated by a fresh
  // inline arrow on every re-render (the board's 3s realtime poll re-renders
  // this component regardless of which panel is open).
  const handleCloseAnalytics = useCallback(() => setActivePanel("board"), []);

  // A student opened "Board settings" from inside their group board: jump
  // straight to that class board's detail view in Settings.
  const handleOpenClassBoardSettings = useCallback((boardId: string) => {
    setPendingClassBoardId(boardId);
    setActiveClass(null);
    setActivePanel("settings");
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
      setTaskTotal(cached.total);
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
        setTaskTotal(data.total);
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

  // Load the next 100 tasks and append them to the current list
  const loadMoreTasks = useCallback(async () => {
    const boardId = activeBoardIdRef.current;
    setIsLoadingBoard(true);
    // Read current task count synchronously via functional setter to avoid stale closure
    let skip = 0;
    setTasks((prev) => { skip = prev.length; return prev; });
    const res = await fetch(`/api/tasks?boardId=${boardId}&skip=${skip}&take=100`, { cache: "no-store" });
    if (res.ok && activeBoardIdRef.current === boardId) {
      const payload = await res.json();
      const incoming = (payload.tasks ?? []) as Task[];
      const total = (payload.total ?? 0) as number;
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const merged = [...prev, ...incoming.filter((t) => !existingIds.has(t.id))];
        boardCache.current.set(boardId, { tasks: merged, columns: columnsRef.current, fetchedAt: Date.now(), total });
        return merged;
      });
      setTaskTotal(total);
    }
    setIsLoadingBoard(false);
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

  const handleReorderClasses = useCallback(async (ids: string[]) => {
    const res = await fetch("/api/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    // The sidebar reorders one section at a time (student / educator / archived),
    // so `ids` is only that subset. Splice the reordered subset back into their
    // existing slots in the full list instead of replacing the whole list with
    // the subset — otherwise the untouched sections vanish until a reload.
    setClasses((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      const reordered = ids.map((id) => map.get(id)!).filter(Boolean);
      const reorderedIds = new Set(ids);
      let next = 0;
      return prev.map((c) => (reorderedIds.has(c.id) ? reordered[next++] : c));
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
        onClassReorder={handleReorderClasses}
        onBoardHover={prefetchBoard}
        isAdmin={isAdmin}
        mobileOpen={navOpen}
        onMobileOpenChange={setNavOpen}
      />

      <main
        className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-paper relative z-30 transition-transform duration-300 ease-out ${navOpen ? "translate-x-full md:translate-x-0" : ""}`}
      >
        {activeClass && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <StudentClassView activeClass={activeClass} currentUserId={currentUserId} onLeave={handleLeaveClass} onOpenNav={() => setNavOpen(true)} onOpenBoardSettings={handleOpenClassBoardSettings} />
          </div>
        )}
        {!activeClass && activePanel === "board" && (
          <>
            {tasks.length < taskTotal && (
              <div className="flex items-center justify-between px-5 py-1.5 text-xs text-muted bg-column-bg/60 border-b border-border/30 shrink-0">
                <span>Showing {tasks.length} of {taskTotal} tasks</span>
                <button
                  onClick={loadMoreTasks}
                  disabled={isLoadingBoard}
                  className="text-primary hover:text-primary/70 font-medium transition-colors disabled:opacity-50"
                >
                  Load {Math.min(100, taskTotal - tasks.length)} more
                </button>
              </div>
            )}
            <div className="flex-1 overflow-hidden flex flex-col">
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
                onOpenNav={() => setNavOpen(true)}
                onOpenSettings={() => { setPendingClassBoardId(null); setActivePanel("settings"); }}
                onOpenAnalytics={() => handlePanelChange("analytics")}
                canViewTrash
              />
            </div>
          </>
        )}
        {activePanel === "analytics" && (
          <ClientErrorBoundary
            fallback={<div className="flex-1 flex items-center justify-center text-muted text-sm">Failed to load analytics. <button onClick={() => setActivePanel("board")} className="ml-3 text-xs underline">Back</button></div>}
          >
            <AnalyticsPanel key={analyticsRenderKey} boardName={activeBoard?.name ?? ""} boardId={activeBoardId} onClose={handleCloseAnalytics} />
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
            classBoards={classes
              .filter((c) => c.role === "student" && c.boardId && !c.archived)
              .map((c) => ({ classId: c.id, className: c.name, groupName: c.groupName ?? null, boardId: c.boardId! }))}
            onSwitchToBoard={(boardId) => { handleBoardSwitch(boardId); setActivePanel("board"); }}
            onLeaveClass={handleLeaveClass}
            onClose={() => { setPendingClassBoardId(null); setActivePanel("board"); }}
            initialClassBoardId={pendingClassBoardId ?? undefined}
          />
        )}
        {activePanel === "profile" && <ProfilePanel onClose={() => setActivePanel("board")} />}
        {activePanel === "admin" && <AdminPanel />}
        {activePanel === "help" && <HelpPanel onClose={() => setActivePanel("board")} />}
      </main>
      <AnnouncementModal />
    </div>
  );
}
