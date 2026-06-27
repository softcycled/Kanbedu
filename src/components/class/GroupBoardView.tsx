"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Task, ColumnData } from "@/lib/types";
import Board from "../Board";
import { useRealtime } from "@/hooks/useRealtime";

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
      />
    </div>
  );
}
