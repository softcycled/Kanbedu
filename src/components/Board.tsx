"use client";

import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import { Task, Comment, ColumnData } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import Skeleton from "./Skeleton";
import dynamic from "next/dynamic";
const TaskModal = dynamic(() => import("./TaskModal"), { ssr: false, loading: () => null });
import TaskCard from "./TaskCard";
import DeleteColumnModal from "./DeleteColumnModal";
import FilterBar from "./FilterBar";
import ListView from "./ListView";
import useBoardResources from "@/hooks/useBoardResources";
import { useToasts } from "@/components/Toasts";

interface Props {
  boardId: string;
  boardName?: string;
  tasks: Task[];
  columns: ColumnData[];
  onTasksChange: (update: Task[] | ((prev: Task[]) => Task[])) => void;
  onColumnsChange: (update: ColumnData[] | ((prev: ColumnData[]) => ColumnData[])) => void;
  currentUserId?: string;
  isLoading?: boolean;
}

export default function Board({ boardId, boardName, tasks, columns, onTasksChange, onColumnsChange, currentUserId, isLoading = false }: Props) {
  // Dummy function to satisfy dependencies since broadcasting is now server-side
  const broadcastRefresh = useCallback((payload?: unknown) => {}, []);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnData | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [boardMembersLocal, setBoardMembersLocal] = useState<import("@/lib/types").BoardMemberData[]>([]);
  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<import("@/lib/types").Tag[]>([]);
  // View mode state
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Toggle slider refs/state for animated highlight
  const toggleRef = useRef<HTMLDivElement | null>(null);
  const boardBtnRef = useRef<HTMLButtonElement | null>(null);
  const listBtnRef = useRef<HTMLButtonElement | null>(null);
  const [sliderPos, setSliderPos] = useState({ left: 0, width: 0 });

  // use shared board resources (members, tags) to avoid duplicate fetches
  const {
    members: boardMembers,
    tags: allTagsFromHook,
    loadingMembers,
    loadingTags,
    reloadMembers,
    reloadTags,
    setMembersForBoard,
    setTagsForBoard,
  } = useBoardResources(boardId);

  // Keep a local placeholder so existing code that may have referenced setBoardMembers
  // earlier doesn't break; but the hook-backed `boardMembers` is the source of truth.
  useEffect(() => {
    setBoardMembersLocal(boardMembers);
  }, [boardMembers]);
  useEffect(() => {
    setAllTags(allTagsFromHook);
  }, [allTagsFromHook]);

  const toasts = useToasts();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search query filter (title)
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Assignee filter (OR within category)
      if (selectedAssignees.length > 0) {
        const assigneeId = task.assigneeId || "unassigned";
        if (!selectedAssignees.includes(assigneeId)) return false;
      }

      // Tags filter (OR within category - match if task has ANY of the selected tags)
      if (selectedTags.length > 0) {
        const taskTagIds = task.tags?.map((t) => t.id) || [];
        const hasMatchingTag = selectedTags.some((id) => taskTagIds.includes(id));
        if (!hasMatchingTag) return false;
      }

      // Priority filter (OR within category)
      if (selectedPriorities.length > 0) {
        if (!selectedPriorities.includes(task.priority)) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedAssignees, selectedTags, selectedPriorities]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filteredTasks) {
      const bucket = map.get(t.column) ?? [];
      bucket.push(t);
      map.set(t.column, bucket);
    }
    for (const [, bucket] of map) bucket.sort((a, b) => a.order - b.order);
    return map;
  }, [filteredTasks]);

  const getTasksByColumn = useCallback(
    (columnId: string) => tasksByColumn.get(columnId) ?? [],
    [tasksByColumn]
  );

  // Position the toggle slider under the active button and update on resize/view change
  useLayoutEffect(() => {
    const update = () => {
      const container = toggleRef.current;
      const target = viewMode === "board" ? boardBtnRef.current : listBtnRef.current;
      if (!container || !target) return;
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const left = Math.round(tRect.left - cRect.left);
      const width = Math.round(tRect.width);
      setSliderPos({ left, width });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewMode]);

  // ── Column actions ─────────────────────────────────────────────

  const handleRenameColumn = useCallback(async (columnId: string, newLabel: string) => {
    try {
      const res = await fetch(`/api/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });

      if (res.ok) {
        const updated = await res.json();
        onColumnsChange((prev) =>
          prev.map((col) => (col.id === columnId ? updated : col))
        );
        broadcastRefresh();
      }
    } catch (error) {
      console.error("Failed to rename column:", error);
    }
  }, [broadcastRefresh, tasks, onTasksChange]);

  const handleSetDoneColumn = useCallback(async (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    // Toggle: if already done, un-mark it; otherwise set it as done.
    const newIsDone = !col.isDone;
    try {
      const res = await fetch(`/api/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: newIsDone }),
      });
      if (res.ok) {
        // Server enforces single-done: clear all then set this one.
        onColumnsChange((prev) =>
          prev.map((c) =>
            c.id === columnId
              ? { ...c, isDone: newIsDone }
              : newIsDone
              ? { ...c, isDone: false }
              : c
          )
        );
        broadcastRefresh();
      }
    } catch (error) {
      console.error("Failed to set done column:", error);
    }
  }, [columns, broadcastRefresh]);

  const handleDeleteColumnClick = useCallback((columnId: string) => {
    const columnData = columns.find((c) => c.id === columnId);
    if (columnData) {
      setDeleteError(null);
      setColumnToDelete(columnData);
      setDeleteModalOpen(true);
    }
  }, [columns]);

  const handleConfirmDeleteColumn = useCallback(
    async (moveToColumnId?: string) => {
      if (!columnToDelete) return;

      try {
        const res = await fetch(`/api/columns/${columnToDelete.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moveToColumnId: moveToColumnId || null }),
        });

        if (!res.ok) {
          const errorData = await res.text();
          console.error("Delete failed:", res.status, errorData);
          setDeleteError("Delete failed. Please try again.");
          return;
        }

        onColumnsChange((prev) => prev.filter((col) => col.id !== columnToDelete.id));
        if (moveToColumnId) {
          onTasksChange((prev) =>
            prev.map((t) =>
              t.column === columnToDelete.id ? { ...t, column: moveToColumnId } : t
            )
          );
        } else {
          onTasksChange((prev) => prev.filter((t) => t.column !== columnToDelete.id));
        }
        setDeleteError(null);
        setDeleteModalOpen(false);
        // capture label for undo
        const deletedLabel = columnToDelete.label;
        const deletedId = columnToDelete.id;
        setColumnToDelete(null);
        broadcastRefresh();

        // Show undo for best-effort recreation
        toasts.push({
          title: "Column deleted",
          description: deletedLabel,
          actionLabel: "Undo",
          onAction: async () => {
            try {
              const r = await fetch("/api/columns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: deletedLabel, boardId }),
              });
              if (!r.ok) throw new Error("Restore failed");
              const created = await r.json();
              onColumnsChange((prev) => [...prev, created]);
              broadcastRefresh();
            } catch (err) {
              console.error("Undo restore column failed", err);
            }
          },
        });
      } catch (error) {
        console.error("Failed to delete column:", error);
        setDeleteError("Delete failed. Please try again.");
      }
    },
    [columnToDelete, broadcastRefresh]
  );

  const handleAddColumn = useCallback(async () => {
    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New column", boardId }),
      });

      if (res.ok) {
        const newColumn = await res.json();
        onColumnsChange((prev) => [...prev, newColumn]);
        broadcastRefresh();
      }
    } catch (error) {
      console.error("Failed to create column:", error);
    }
  }, [boardId, broadcastRefresh]);

  // ── Scroll refs ───────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const edgeScrollFrame = useRef<number | null>(null);
  const panState = useRef({ active: false, activated: false, startX: 0, startScrollLeft: 0 });

  // ── Edge-scroll during dnd-kit drag ───────────────────────────
  const startEdgeScroll = useCallback((clientX: number) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const ZONE = 120; // px from edge to activate
    const MAX_SPEED = 20;

    const distLeft = clientX - rect.left;
    const distRight = rect.right - clientX;

    let speed = 0;
    if (distLeft < ZONE) speed = -MAX_SPEED * (1 - distLeft / ZONE);
    else if (distRight < ZONE) speed = MAX_SPEED * (1 - distRight / ZONE);

    if (speed !== 0) {
      scrollRef.current.scrollLeft += speed;
    }

    edgeScrollFrame.current = requestAnimationFrame(() => startEdgeScroll(clientX));
  }, []);

  const stopEdgeScroll = useCallback(() => {
    if (edgeScrollFrame.current !== null) {
      cancelAnimationFrame(edgeScrollFrame.current);
      edgeScrollFrame.current = null;
    }
  }, []);

  // Start/stop edge-scroll loop when a dnd-kit drag is active
  useEffect(() => {
    if (!activeTask && !activeColumn) {
      stopEdgeScroll();
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      stopEdgeScroll();
      startEdgeScroll(e.clientX);
    };

    document.addEventListener('pointermove', onPointerMove);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      stopEdgeScroll();
    };
  }, [activeTask, activeColumn, startEdgeScroll, stopEdgeScroll]);

  // ── Drag handlers ──────────────────────────────────────────────

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
      return;
    }

    const column = columns.find((c) => c.id === active.id);
    if (column) {
      setActiveColumn(column);
    }
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a column
    const isDraggingColumn = columns.some((c) => c.id === activeId);
    if (isDraggingColumn) {
      // Column dragging doesn't need live updates like task dragging
      return;
    }

    // Otherwise, handle task dragging
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine destination column
    const overTask = tasks.find((t) => t.id === overId);
    const destColumn: string | undefined = overTask
      ? overTask.column
      : columns.find((c) => c.id === overId)?.id;

    if (!destColumn || activeTask.column === destColumn) return;

    onTasksChange((prev) => {
      const updated = prev.map((t) =>
        t.id === activeId
          ? { ...t, column: destColumn, columnUpdatedAt: new Date() }
          : t
      );
      return updated;
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a column
    const draggedColumn = columns.find((c) => c.id === activeId);
    if (draggedColumn) {
      const overTask = tasks.find((t) => t.id === overId);
      const overColumnId = overTask ? overTask.column : overId;
      const overColumn = columns.find((c) => c.id === overColumnId);
      if (!overColumn) return;

      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overColumnId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(columns, oldIndex, newIndex);

      // Update local state immediately
      onColumnsChange(reordered);

      // Persist order to server
      const updates = reordered.map((col, idx) => ({
        id: col.id,
        order: idx,
      }));

      // Persist order to server — fire-and-forget, UI already updated
      fetch("/api/columns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updates }),
      }).catch((error) => console.error("Failed to persist column order:", error));

      broadcastRefresh();
      return;
    }

    // Handle task dragging
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Determine destination column
    const overTask = tasks.find((t) => t.id === overId);
    const destColumn: string | undefined = overTask
      ? overTask.column
      : columns.find((c) => c.id === overId)?.id;
    if (!destColumn) return;

    // Reorder within column
    const columnTasks = tasks
      .filter((t) => t.column === destColumn)
      .sort((a, b) => a.order - b.order);

    const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
    const newIndex = overTask
      ? columnTasks.findIndex((t) => t.id === overId)
      : columnTasks.length - 1;

    let reordered = oldIndex === -1
      ? [...columnTasks.filter((t) => t.id !== activeId), task]
      : arrayMove(columnTasks, oldIndex, newIndex < 0 ? columnTasks.length - 1 : newIndex);

    // Assign new order values
    const orderMap: Record<string, number> = {};
    reordered.forEach((t, i) => {
      orderMap[t.id] = i;
    });

    onTasksChange((prev) =>
      prev.map((t) =>
        orderMap[t.id] !== undefined
          ? { ...t, order: orderMap[t.id], column: destColumn }
          : t
      )
    );

    // Persist to server
    const isColumnChange = task.column !== destColumn;
    const isMoverMismatch =
      isColumnChange &&
      !!task.assigneeId &&
      !!currentUserId &&
      task.assigneeId !== currentUserId;

    const res = await fetch(`/api/tasks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column: destColumn,
        order: orderMap[activeId],
        ...(isMoverMismatch ? { movedByNonAssignee: true } : {}),
      }),
    });

    if (res.ok) {
      const updatedTask = await res.json();
      onTasksChange((prev) =>
        prev.map((t) => (t.id === activeId ? updatedTask : t))
      );
      broadcastRefresh({ type: "task:update", task: updatedTask });
    }

    // Update sibling orders in a single bulk request — fire-and-forget
    const siblings = reordered.filter((t) => t.id !== activeId);
    if (siblings.length > 0) {
      fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siblings.map((t) => ({ id: t.id, order: orderMap[t.id] }))),
      }).catch((err) => console.error("Failed to bulk update task order:", err));
    }

  };

  // ── Task actions ───────────────────────────────────────────────

  const handleAddTask = useCallback(async (title: string, column: string) => {
    // Optimistic UI: insert a temporary task locally immediately
    const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const now = new Date();
    const colTasks = tasks.filter((t) => t.column === column);
    const maxOrder = colTasks.length ? Math.max(...colTasks.map((t) => t.order)) : -1;
    const tempTask: Task = {
      id: tempId,
      title,
      description: "",
      deadline: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      column,
      columnUpdatedAt: now,
      assigneeId: null,
      order: maxOrder + 1,
      priority: "normal",
      movedByNonAssignee: false,
      comments: [],
      tags: [],
      activities: [],
    };

    onTasksChange((prev) => [...prev, tempTask]);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, column }),
      });
      if (!res.ok) throw new Error(`Add task failed: ${res.status}`);
      const newTask: Task = await res.json();

      // Replace the temp task with server-supplied task
      onTasksChange((prev) => prev.map((t) => (t.id === tempId ? newTask : t)));
      broadcastRefresh({ type: "task:create", task: newTask });
    } catch (error) {
      console.error("Failed to add task:", error);
      // Rollback optimistic insert
      onTasksChange((prev) => prev.filter((t) => t.id !== tempId));
    }
  }, [broadcastRefresh, tasks, onTasksChange]);

  const handleUpdateTask = useCallback(async (id: string, data: Partial<Task>) => {
    const prevTask = tasks.find((t) => t.id === id);
    // Optimistic update locally
    onTasksChange((prev) => prev.map((t) => (t.id === id ? { ...t, ...data, updatedAt: new Date() } : t)));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(`Task update failed: ${res.status}`);
      }
      const updatedTask: Task = await res.json();

      // Use the server response to ensure fresh data
      onTasksChange((prev) => prev.map((t) => (t.id === id ? updatedTask : t)));
      setSelectedTask((prev) => (prev?.id === id ? updatedTask : prev));
      broadcastRefresh({ type: "task:update", task: updatedTask });
    } catch (error) {
      console.error("Failed to update task:", error);
      // rollback optimistic update
      if (prevTask) onTasksChange((prev) => prev.map((t) => (t.id === id ? prevTask : t)));
    }
  }, [broadcastRefresh]);

  const handleUpdateTaskTitle = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    onTasksChange((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t))
    );
    setSelectedTask((prev) => (prev?.id === id ? { ...prev, title: trimmed } : prev));

    await handleUpdateTask(id, { title: trimmed });
  }, [handleUpdateTask]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const prevTask = tasks.find((t) => t.id === id);
    if (!prevTask) return;

    // Optimistic removal
    onTasksChange((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
      broadcastRefresh({ type: "task:delete", taskId: id });

      // Show undo toast (best-effort restore)
      toasts.push({
        title: "Task deleted",
        description: prevTask.title,
        actionLabel: "Undo",
        onAction: async () => {
          try {
            const r = await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: prevTask.title, column: prevTask.column }),
            });
            if (!r.ok) throw new Error("Restore failed");
            const restored = await r.json();
            onTasksChange((prev) => [...prev, restored]);
            broadcastRefresh({ type: "task:create", task: restored });
          } catch (err) {
            console.error("Undo restore failed", err);
          }
        },
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
      // rollback optimistic removal on failure
      onTasksChange((prev) => (prevTask ? [...prev, prevTask] : prev));
    }
  }, [broadcastRefresh, onTasksChange, tasks, toasts]);

  const handleAddComment = useCallback(
    async (taskId: string, content: string, author: string): Promise<Comment> => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, content, author }),
      });
      if (!res.ok) throw new Error(`Add comment failed: ${res.status}`);
      const comment: Comment = await res.json();
      onTasksChange((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
        )
      );
      broadcastRefresh();
      return comment;
    },
    [broadcastRefresh]
  );

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const s = panState.current;
      if (!s.active || !scrollRef.current) return;
      const dx = e.clientX - s.startX;
      if (!s.activated && Math.abs(dx) < 5) return;
      if (!s.activated) {
        s.activated = true;
        setIsPanning(true);
      }
      scrollRef.current.scrollLeft = s.startScrollLeft - dx;
    };

    const onMouseUp = () => {
      if (panState.current.active) {
        panState.current.active = false;
        panState.current.activated = false;
        setIsPanning(false);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (activeTask || activeColumn) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-column]') ||
      target.closest('[data-task]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea')
    ) return;
    panState.current = {
      active: true,
      activated: false,
      startX: e.clientX,
      startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
    };
  };

  // All columns are deletable as long as more than one remains.
  // (Label-based "default" detection was fragile and broke on rename.)

  return (
    <>
      {/* Header row: board name left, filters right */}
      <div className="flex-shrink-0 flex items-center gap-4 pl-[4.5rem] pr-6 md:px-10 pt-6 pb-5 border-b border-border/60">
        <h1 className="text-xl font-bold tracking-tight text-ink shrink-0">{boardName || "Board"}</h1>
        <FilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedAssignees={selectedAssignees}
          setSelectedAssignees={setSelectedAssignees}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          selectedPriorities={selectedPriorities}
          setSelectedPriorities={setSelectedPriorities}
          members={boardMembers}
          tags={allTags}
          totalTasks={tasks.length}
          filteredTasksCount={filteredTasks.length}
        />
        {/* View mode toggle (animated slider) */}
        <div ref={toggleRef} className="relative flex items-center gap-1 px-1 py-1 bg-column-bg rounded-lg border border-border/30 flex-shrink-0">
          {/* Sliding indicator */}
          <div
            aria-hidden
            style={{ left: `${sliderPos.left}px`, width: `${sliderPos.width}px` }}
            className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md bg-ink/10 transition-all duration-180 ease-out pointer-events-none"
          />
          <button
            ref={boardBtnRef}
            onClick={() => setViewMode("board")}
            title="Board view"
            className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
              viewMode === "board"
                ? "text-ink/90"
                : "text-muted/70 hover:text-ink/80"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ transform: 'translateY(0.3px)', transformOrigin: 'center center' }}>
              <rect x="1" y="1" width="5" height="5" rx="1"/>
              <rect x="8" y="1" width="5" height="5" rx="1"/>
              <rect x="1" y="8" width="5" height="5" rx="1"/>
              <rect x="8" y="8" width="5" height="5" rx="1"/>
            </svg>
          </button>
          <button
            ref={listBtnRef}
            onClick={() => setViewMode("list")}
            title="List view"
            className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
              viewMode === "list"
                ? "text-ink/90"
                : "text-muted/70 hover:text-ink/80"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ transform: 'translateY(0.2px)', transformOrigin: 'center center' }}>
              <line x1="1" y1="3" x2="13" y2="3"/>
              <line x1="1" y1="7" x2="13" y2="7"/>
              <line x1="1" y1="11" x2="13" y2="11"/>
            </svg>
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <ListView
          tasks={filteredTasks}
          columns={columns}
          boardMembers={boardMembers}
          onTaskClick={setSelectedTask}
          onAddTask={handleAddTask}
        />
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-auto no-scrollbar"
          style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: isPanning ? 'none' : undefined }}
          onMouseDown={handlePanMouseDown}
        >
          <DndContext
            id="kanban-board"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-7 min-h-full pb-8 pl-[4.5rem] pr-6 md:px-10 pt-6">
            {isLoading ? (
              // Render simple skeleton columns while loading
              Array.from({ length: Math.max(1, columns.length || 3) }).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex-shrink-0 w-80">
                  <Skeleton className="h-5 w-40 mb-4" />
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((__, j) => (
                      <Skeleton key={j} className="h-14 rounded-md" />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              columns.map((col, index) => (
                <KanbanColumn
                  key={col.id}
                  columnId={col.id}
                  label={col.label}
                  columnIndex={index}
                  isDone={col.isDone}
                  tasks={getTasksByColumn(col.id)}
                  onTaskClick={handleTaskClick}
                  onAddTask={handleAddTask}
                  onRenameColumn={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumnClick}
                  onSetDoneColumn={handleSetDoneColumn}
                  isDynamic={columns.length > 1}
                />
              ))
            )}

            {/* Add column button */}
            <div className="flex-shrink-0 w-[85vw] md:w-96 flex items-start">
              <button
                onClick={handleAddColumn}
                className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-border text-sm text-muted hover:text-ink hover:border-ink transition-colors font-medium"
              >
                + Add column
              </button>
            </div>
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTask && (
              <div className="rotate-1 scale-105 opacity-90 pointer-events-none">
                <TaskCard
                  task={activeTask}
                  onClick={() => {}}
                />
              </div>
            )}
            {activeColumn && (
              <div className="w-[85vw] md:w-96 bg-card-bg/95 rounded-lg border-2 border-blue-400 dark:border-blue-600 shadow-xl opacity-95 pointer-events-none scale-105">
                <div className="p-3 font-bold text-sm text-ink">{activeColumn.label}</div>
                <div className="px-3 pb-3 text-xs text-muted">
                  {getTasksByColumn(activeColumn.id).length} tasks
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      )}

      <TaskModal
        task={selectedTask}
        boardId={boardId}
        boardMembers={boardMembers}
        columns={columns}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAddComment={handleAddComment}
        onBroadcast={broadcastRefresh}
      />

      {columnToDelete && (
        <DeleteColumnModal
          column={columnToDelete}
          taskCount={getTasksByColumn(columnToDelete.id).length}
          otherColumns={columns.filter((col) => col.id !== columnToDelete.id)}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setColumnToDelete(null);
            setDeleteError(null);
          }}
          onConfirmDelete={handleConfirmDeleteColumn}
          errorMessage={deleteError}
        />
      )}
    </>
  );
}
