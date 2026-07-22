"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Task, ColumnData } from "@/lib/types";
import Board from "../Board";
import ClientErrorBoundary from "../ClientErrorBoundary";
import { useRealtime } from "@/hooks/useRealtime";
import { trackEvent } from "@/lib/analytics";

// Lazy-loaded: recharts is heavy and only pulled in when a viewer actually opens
// the Analytics view for a group board. Mirrors BoardContainer's personal-board
// analytics import so the class bundle stays lean.
const AnalyticsPanel = dynamic(() => import("../AnalyticsPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-8 space-y-4" aria-hidden>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
    </div>
  ),
});

interface Props {
  boardId: string;
  boardName: string;
  currentUserId: string;
  realtimeSecret?: string | null;
  // Forwarded to <Board> so the class shell can render a breadcrumb title and a
  // "Leave class" action inside the single board header row.
  headerTitle?: ReactNode;
  headerTrailing?: ReactNode;
  onOpenNav?: () => void;
  // Only educators/TAs see the trash on class group boards.
  canViewTrash?: boolean;
}

interface BoardCache {
  tasks: Task[];
  columns: ColumnData[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;
const boardCache = new Map<string, BoardCache>();

// Single-board wrapper used inside a class workspace. Mirrors the per-board
// data plumbing of BoardContainer (load tasks/columns, surgical realtime
// refresh) for exactly one group board, then renders the shared <Board>.
export default function GroupBoardView({ boardId, boardName, currentUserId, realtimeSecret, headerTitle, headerTrailing, onOpenNav, canViewTrash }: Props) {
  const initialCache = boardCache.get(boardId);
  const isFresh = !!initialCache && Date.now() - initialCache.fetchedAt <= CACHE_TTL_MS;

  const [tasks, setTasks] = useState<Task[]>(initialCache?.tasks ?? []);
  const [columns, setColumns] = useState<ColumnData[]>(initialCache?.columns ?? []);
  const [isLoading, setIsLoading] = useState(!isFresh);
  const [fetchError, setFetchError] = useState(false);

  // Board vs. in-depth chart analytics for this group board. Reuses the exact
  // panel personal boards get; available to whoever can already open the board
  // (educators/TAs on every group, students on their own), since /api/analytics
  // gates on board membership the same way /api/tasks does.
  const [view, setView] = useState<"board" | "analytics">("board");

  useEffect(() => {
    if (view === "analytics") trackEvent("panel_view", { panel: "analytics", context: "class" });
  }, [view]);

  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);

  // Keep cache current whenever local state changes (realtime surgical updates included)
  useEffect(() => {
    if (!isLoading) {
      boardCache.set(boardId, { tasks, columns, fetchedAt: Date.now() });
    }
  }, [tasks, columns, boardId, isLoading]);

  const fetchBoardData = useCallback(async () => {
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${boardId}&take=0`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${boardId}`, { cache: "no-store" }),
    ]);
    const tasksPayload = tasksRes.ok ? await tasksRes.json() : { tasks: [], total: 0 };
    return {
      tasks: (tasksPayload.tasks ?? []) as Task[],
      columns: columnsRes.ok ? await columnsRes.json() : [],
    };
  }, [boardId]);

  useEffect(() => {
    const cached = boardCache.get(boardId);
    if (cached && Date.now() - cached.fetchedAt <= CACHE_TTL_MS) return; // fresh — skip fetch

    let cancelled = false;
    fetchBoardData()
      .then((data) => {
        if (cancelled) return;
        boardCache.set(boardId, { ...data, fetchedAt: Date.now() });
        setTasks(data.tasks);
        setColumns(data.columns);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          setFetchError(true);
        }
      });
    return () => { cancelled = true; };
  }, [fetchBoardData, boardId]);

  const handleRefresh = useCallback(async (payload?: any) => {
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
    const data = await fetchBoardData();
    boardCache.set(boardId, { ...data, fetchedAt: Date.now() });
    setTasks(data.tasks);
    setColumns(data.columns);
  }, [fetchBoardData, boardId]);

  useRealtime(realtimeSecret ?? null, handleRefresh);

  if (fetchError && !isLoading && tasks.length === 0 && columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <p className="text-sm font-medium text-foreground">Could not load the board</p>
          <p className="text-xs text-muted mt-1">Check your connection and refresh the page.</p>
        </div>
      </div>
    );
  }

  if (view === "analytics") {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Navigation-only bar back to the board. AnalyticsPanel renders its own
            "Analytics" title/refresh below; its built-in close is mobile-only,
            which isn't enough here, so this bar handles back on every viewport. */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 md:px-10 pt-4 pb-3.5 md:pt-6 md:pb-5 border-b border-border/60">
          <button
            onClick={() => setView("board")}
            aria-label="Back to board"
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Board
          </button>
        </div>
        <ClientErrorBoundary fallback={<div className="text-sm text-muted">Failed to load analytics.</div>}>
          <AnalyticsPanel boardName={boardName} boardId={boardId} />
        </ClientErrorBoundary>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Board
        key={boardId}
        boardId={boardId}
        boardName={boardName}
        tasks={tasks}
        columns={columns}
        onTasksChange={setTasks}
        onColumnsChange={setColumns}
        isLoading={isLoading}
        currentUserId={currentUserId}
        headerTitle={headerTitle}
        headerTrailing={headerTrailing}
        onOpenNav={onOpenNav}
        canViewTrash={canViewTrash}
        onOpenAnalytics={() => setView("analytics")}
      />
    </div>
  );
}
