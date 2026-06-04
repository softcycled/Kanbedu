"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Task, ColumnData } from "@/lib/types";
import Board from "../Board";
import { useRealtime } from "@/hooks/useRealtime";

interface Props {
  boardId: string;
  boardName: string;
  currentUserId: string;
  realtimeSecret?: string | null;
}

// Single-board wrapper used inside a class workspace. Mirrors the per-board
// data plumbing of BoardContainer (load tasks/columns, surgical realtime
// refresh) for exactly one group board, then renders the shared <Board>.
export default function GroupBoardView({ boardId, boardName, currentUserId, realtimeSecret }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);

  const fetchBoardData = useCallback(async () => {
    const [tasksRes, columnsRes] = await Promise.all([
      fetch(`/api/tasks?boardId=${boardId}`, { cache: "no-store" }),
      fetch(`/api/columns?boardId=${boardId}`, { cache: "no-store" }),
    ]);
    return {
      tasks: tasksRes.ok ? await tasksRes.json() : [],
      columns: columnsRes.ok ? await columnsRes.json() : [],
    };
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchBoardData().then((data) => {
      if (cancelled) return;
      setTasks(data.tasks);
      setColumns(data.columns);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchBoardData]);

  const handleRefresh = useCallback(async (payload?: any) => {
    if (payload && payload.task) {
      const t = payload.task;
      setTasks((prev) => {
        const exists = prev.some((p) => p.id === t.id);
        if (exists) return prev.map((p) => (p.id === t.id ? { ...p, ...t } : p));
        const hasColumn = columnsRef.current.some((c) => c.id === t.column);
        if (!hasColumn) return prev;
        return [...prev, t];
      });
      return;
    }
    const data = await fetchBoardData();
    setTasks(data.tasks);
    setColumns(data.columns);
  }, [fetchBoardData]);

  useRealtime(realtimeSecret ?? null, handleRefresh);

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
      />
    </div>
  );
}
