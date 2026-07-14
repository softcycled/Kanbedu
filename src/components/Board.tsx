"use client";

import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect, type ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import { Task, Comment, ColumnData } from "@/lib/types";
import { resolveColumnPalette } from "@/lib/columnPalette";
import KanbanColumn from "./KanbanColumn";
import Skeleton from "./Skeleton";
import dynamic from "next/dynamic";
const TaskModal = dynamic(() => import("./TaskModal"), { ssr: false, loading: () => null });
const TrashPanel = dynamic(() => import("./TrashPanel"), { ssr: false, loading: () => null });
import TaskCard from "./TaskCard";
import DeleteColumnModal from "./DeleteColumnModal";
import FilterBar from "./FilterBar";
import ListView from "./ListView";
import useBoardResources from "@/hooks/useBoardResources";
import { trackEvent } from "@/lib/analytics";
import { useToasts } from "@/components/Toasts";
import BoardHeaderMenu from "./BoardHeaderMenu";

interface Props {
  boardId: string;
  boardName?: string;
  tasks: Task[];
  columns: ColumnData[];
  onTasksChange: (update: Task[] | ((prev: Task[]) => Task[])) => void;
  onColumnsChange: (update: ColumnData[] | ((prev: ColumnData[]) => ColumnData[])) => void;
  currentUserId?: string;
  isLoading?: boolean;
  // Optional header overrides used by class group boards: a breadcrumb that
  // replaces the plain board-name title, and trailing content (e.g. a "Leave
  // class" action) pinned to the far right of the header row.
  headerTitle?: ReactNode;
  headerTrailing?: ReactNode;
  // Mobile only: when provided, renders a "<" trigger at the start of the mobile
  // header that opens the app sidebar (the board slides off to reveal it).
  onOpenNav?: () => void;
  // When true, shows the "Recently deleted" trash entry point. Personal board
  // owners always; class group boards only for educators/TAs.
  canViewTrash?: boolean;
  // When provided (personal boards only), the board-name title becomes a
  // dropdown menu (invite / settings / analytics / leave). "Board settings"
  // calls this to open the settings panel. Class boards pass headerTitle
  // instead, so the menu never renders there.
  onOpenSettings?: () => void;
  // Opens the analytics panel for this board, from the board-name dropdown.
  onOpenAnalytics?: () => void;
}

export default function Board({ boardId, boardName, tasks, columns, onTasksChange, onColumnsChange, currentUserId, isLoading = false, headerTitle, headerTrailing, onOpenNav, canViewTrash = false, onOpenSettings, onOpenAnalytics }: Props) {
  const [trashOpen, setTrashOpen] = useState(false);
  // Broadcasting is now server-side only — this is a stable no-op to satisfy call sites
  const broadcastRefresh = useCallback((_payload?: unknown) => {}, []);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnData | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  // View mode state — default to list on mobile after hydration
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  useLayoutEffect(() => {
    if (window.matchMedia("(max-width: 768px)").matches) setViewMode("list");
  }, []);
  useEffect(() => { setMobileFilterOpen(false); }, [viewMode]);

  // Toggle slider refs/state for animated highlight. Mobile and desktop render
  // separate toggle instances (one is always display:none), so each needs its
  // own refs/position — sharing one set measures whichever is hidden as 0x0.
  const toggleRef = useRef<HTMLDivElement | null>(null);
  const boardBtnRef = useRef<HTMLButtonElement | null>(null);
  const listBtnRef = useRef<HTMLButtonElement | null>(null);
  const [sliderPos, setSliderPos] = useState({ left: 0, width: 0 });
  const desktopToggleRef = useRef<HTMLDivElement | null>(null);
  const desktopBoardBtnRef = useRef<HTMLButtonElement | null>(null);
  const desktopListBtnRef = useRef<HTMLButtonElement | null>(null);
  const [desktopSliderPos, setDesktopSliderPos] = useState({ left: 0, width: 0 });

  // use shared board resources (members, tags) to avoid duplicate fetches
  const { members: boardMembers, tags: allBoardTags } = useBoardResources(boardId);

  // Stable ref so callbacks can read the latest tasks without being recreated on every change
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Captures a dragged task's column/order at drag start. handleDragOver
  // optimistically rewrites the task's column mid-drag, so by drag end the
  // task's own column is the destination — we need this to revert on failure.
  const dragOriginRef = useRef<{ column: string; order: number } | null>(null);

  // Per-column in-flight tracker for color updates. Without this, rapidly
  // picking two colors in a row fires two independent PATCH requests, and
  // whichever response lands last wins — on a real network the earlier pick
  // can resolve after the later one and silently overwrite it, both in the UI
  // and in the DB. Coalescing to "one in-flight request per column, latest
  // pick queued behind it" guarantees the last color the user picked is the
  // one that's ultimately persisted.
  const colorRequestsRef = useRef<Map<string, { inFlight: boolean; queuedColor: string | null; hasQueued: boolean; prevColor: string | null }>>(new Map());

  const toasts = useToasts();

  const sensors = useSensors(
    // Mouse: start dragging after a 5px move — snappy on desktop.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: require a 200ms press-and-hold before dragging, so a normal swipe
    // scrolls the board/column instead of grabbing a card. Without this, every
    // touch-move grabs a card and the board is unscrollable on mobile.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [
          task.title,
          ...(task.assignees?.map((a) => a.name) ?? []),
          task.assigneeUser?.name ?? "",
          ...(task.tags?.map((t) => t.name) ?? []),
        ].join(" ").toLowerCase();
        if (!words.every((w) => haystack.includes(w))) return false;
      }

      // Assignee filter (OR within category) — a multi-assignee task matches
      // if ANY of its assignees is selected
      if (selectedAssignees.length > 0) {
        const taskAssigneeIds = task.assignees?.length
          ? task.assignees.map((a) => a.id)
          : task.assigneeId
          ? [task.assigneeId]
          : ["unassigned"];
        if (!taskAssigneeIds.some((id) => selectedAssignees.includes(id))) return false;
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

  // Position each toggle's slider under its own active button and update on
  // resize/view change. Mobile and desktop are measured independently since
  // only one is ever visible at a given viewport width.
  useLayoutEffect(() => {
    const measure = (
      container: HTMLDivElement | null,
      target: HTMLButtonElement | null,
      setPos: (pos: { left: number; width: number }) => void
    ) => {
      if (!container || !target) return;
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const borderLeft = parseFloat(getComputedStyle(container).borderLeftWidth) || 0;
      setPos({ left: Math.round(tRect.left - cRect.left - borderLeft), width: Math.round(tRect.width) });
    };
    const update = () => {
      measure(toggleRef.current, viewMode === "board" ? boardBtnRef.current : listBtnRef.current, setSliderPos);
      measure(desktopToggleRef.current, viewMode === "board" ? desktopBoardBtnRef.current : desktopListBtnRef.current, setDesktopSliderPos);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewMode]);

  // Done column is always pinned last. nonDone sorted by order so index-based
  // colours are stable if the columns array ever arrives out-of-sequence.
  const sortedColumns = useMemo(() => {
    const nonDone = columns.filter((c) => !c.isDone).sort((a, b) => a.order - b.order);
    const done = columns.filter((c) => c.isDone);
    return [...nonDone, ...done];
  }, [columns]);

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
      } else {
        toasts.push({ title: "Could not rename column", description: "Please try again." });
      }
    } catch (error) {
      console.error("Failed to rename column:", error);
      toasts.push({ title: "Could not rename column", description: "Please try again." });
    }
  }, [broadcastRefresh, onColumnsChange, toasts]);

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
        const updated = columns.map((c) =>
          c.id === columnId ? { ...c, isDone: newIsDone } : newIsDone ? { ...c, isDone: false } : c
        );
        // Marking as done: move that column to the rightmost position and persist the new order.
        const finalColumns = newIsDone
          ? [...updated.filter((c) => c.id !== columnId), updated.find((c) => c.id === columnId)!]
          : updated;
        if (newIsDone) {
          fetch("/api/columns", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ columns: finalColumns.map((c, i) => ({ id: c.id, order: i })) }),
          }).catch((err) => console.error("Failed to persist done-column order:", err));
        }
        onColumnsChange(finalColumns);
        broadcastRefresh();
      } else {
        toasts.push({ title: "Could not update column", description: "Please try again." });
      }
    } catch (error) {
      console.error("Failed to set done column:", error);
      toasts.push({ title: "Could not update column", description: "Please try again." });
    }
  }, [columns, broadcastRefresh, toasts]);

  // Sends one color PATCH for a column and, once it resolves, either sends the
  // next queued pick (if the user picked again while this was in flight) or
  // clears the in-flight flag. Only rolls back on failure if nothing newer is
  // queued — a newer pick superseding a failed older one shouldn't be undone.
  const runColorUpdate = useCallback(async (columnId: string, color: string | null) => {
    const state = colorRequestsRef.current.get(columnId)!;
    try {
      const res = await fetch(`/api/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error("Color update failed");
      const updated = await res.json();
      onColumnsChange((cols) => cols.map((c) => (c.id === columnId ? updated : c)));
      broadcastRefresh();
    } catch (error) {
      console.error("Failed to set column color:", error);
      if (!state.hasQueued) {
        const prevColor = state.prevColor;
        onColumnsChange((cols) => cols.map((c) => (c.id === columnId ? { ...c, color: prevColor } : c)));
        toasts.push({ title: "Could not update color", description: "Please try again." });
      }
    } finally {
      if (state.hasQueued) {
        const next = state.queuedColor;
        state.hasQueued = false;
        runColorUpdate(columnId, next);
      } else {
        state.inFlight = false;
      }
    }
  }, [onColumnsChange, broadcastRefresh, toasts]);

  const handleSetColumnColor = useCallback((columnId: string, color: string | null) => {
    // Optimistic: apply the color immediately regardless of any in-flight request.
    onColumnsChange((cols) => cols.map((c) => (c.id === columnId ? { ...c, color } : c)));

    const existing = colorRequestsRef.current.get(columnId);
    if (existing?.inFlight) {
      existing.queuedColor = color;
      existing.hasQueued = true;
      return;
    }
    const prevColor = columns.find((c) => c.id === columnId)?.color ?? null;
    colorRequestsRef.current.set(columnId, { inFlight: true, queuedColor: null, hasQueued: false, prevColor });
    runColorUpdate(columnId, color);
  }, [columns, onColumnsChange, runColorUpdate]);

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

      // Capture everything needed for a full undo before any state mutation:
      // the column, its tasks (in order), and where the tasks went.
      const deleted = columnToDelete;
      const movedTo = moveToColumnId || null;
      const deletedTasks = tasksRef.current
        .filter((t) => t.column === deleted.id)
        .sort((a, b) => a.order - b.order);

      try {
        const res = await fetch(`/api/columns/${deleted.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moveToColumnId: movedTo }),
        });

        if (!res.ok) {
          const errorData = await res.text();
          console.error("Delete failed:", res.status, errorData);
          setDeleteError("Delete failed. Please try again.");
          return;
        }

        onColumnsChange((prev) => prev.filter((col) => col.id !== deleted.id));
        if (movedTo) {
          onTasksChange((prev) =>
            prev.map((t) =>
              t.column === deleted.id ? { ...t, column: movedTo } : t
            )
          );
        } else {
          onTasksChange((prev) => prev.filter((t) => t.column !== deleted.id));
        }
        setDeleteError(null);
        setDeleteModalOpen(false);
        setColumnToDelete(null);
        broadcastRefresh();

        // Full undo: recreate the column and bring its tasks back. Tasks that were
        // moved elsewhere are moved back; tasks that were deleted are recreated
        // (with new ids — their comments/history can't be recovered).
        toasts.push({
          title: "Column deleted",
          description: deleted.label,
          actionLabel: "Undo",
          onAction: async () => {
            try {
              const r = await fetch("/api/columns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: deleted.label, boardId }),
              });
              if (!r.ok) throw new Error("Restore failed");
              const created = await r.json();
              onColumnsChange((prev) => [...prev, created]);

              if (deletedTasks.length > 0) {
                if (movedTo) {
                  // Move the original tasks back into the recreated column.
                  const ids = new Set(deletedTasks.map((t) => t.id));
                  await Promise.all(
                    deletedTasks.map((t) =>
                      fetch(`/api/tasks/${t.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ column: created.id, order: t.order }),
                      }).catch((err) => console.error("Undo: move task back failed", err))
                    )
                  );
                  onTasksChange((prev) =>
                    prev.map((t) =>
                      ids.has(t.id) ? { ...t, column: created.id } : t
                    )
                  );
                } else {
                  // Recreate the deleted tasks (sequentially to preserve order).
                  const restored: Task[] = [];
                  for (const t of deletedTasks) {
                    try {
                      const tr = await fetch("/api/tasks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: t.title,
                          column: created.id,
                          description: t.description || undefined,
                          assigneeIds: t.assignees?.length
                            ? t.assignees.map((a) => a.id)
                            : t.assigneeId
                            ? [t.assigneeId]
                            : undefined,
                          priority: t.priority !== "medium" ? t.priority : undefined,
                          deadline: t.deadline ? String(t.deadline) : undefined,
                          tagIds: t.tags?.map((tg) => tg.id),
                        }),
                      });
                      if (tr.ok) {
                        const nt: Task = await tr.json();
                        restored.push({ ...nt, assigneeUser: t.assigneeUser ?? null });
                      }
                    } catch (err) {
                      console.error("Undo: recreate task failed", err);
                    }
                  }
                  if (restored.length > 0) {
                    onTasksChange((prev) => [...prev, ...restored]);
                  }
                }
              }

              // Restore the done flag last so its server-side completion sweep
              // applies to the tasks now back in the column.
              if (deleted.isDone) {
                try {
                  const dr = await fetch(`/api/columns/${created.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isDone: true }),
                  });
                  if (dr.ok) {
                    const doneCol = await dr.json();
                    onColumnsChange((prev) =>
                      prev.map((c) => (c.id === created.id ? doneCol : c))
                    );
                  }
                } catch (err) {
                  console.error("Undo: restore done flag failed", err);
                }
              }

              broadcastRefresh();
            } catch (err) {
              console.error("Undo restore column failed", err);
              toasts.push({ title: "Couldn't undo", description: "Please try again." });
            }
          },
        });
      } catch (error) {
        console.error("Failed to delete column:", error);
        setDeleteError("Delete failed. Please try again.");
      }
    },
    [columnToDelete, broadcastRefresh, onColumnsChange, onTasksChange, boardId, toasts]
  );

  const addingColumnRef = useRef(false);
  const handleAddColumn = useCallback(async () => {
    if (addingColumnRef.current) return;
    addingColumnRef.current = true;
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
      } else {
        toasts.push({ title: "Could not add column", description: "Please try again." });
      }
    } catch (error) {
      console.error("Failed to create column:", error);
      toasts.push({ title: "Could not add column", description: "Please try again." });
    } finally {
      addingColumnRef.current = false;
    }
  }, [boardId, broadcastRefresh, toasts]);

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

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      dragOriginRef.current = { column: task.column, order: task.order };
      setActiveTask(task);
      return;
    }

    const column = columns.find((c) => c.id === active.id);
    if (column && !column.isDone) {
      setActiveColumn(column);
    }
  }, [tasks, columns]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
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
  }, [tasks, columns, onTasksChange]);

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging a column
    const draggedColumn = sortedColumns.find((c) => c.id === activeId);
    if (draggedColumn) {
      // Done column is pinned to the end — never draggable.
      if (draggedColumn.isDone) return;

      const overTask = tasksRef.current.find((t) => t.id === overId);
      const overColumnId = overTask ? overTask.column : overId;
      if (!sortedColumns.find((c) => c.id === overColumnId)) return;

      const oldIndex = sortedColumns.findIndex((c) => c.id === activeId);
      // Clamp target so non-done columns can't land after the done column.
      const doneIndex = sortedColumns.findIndex((c) => c.isDone);
      let newIndex = sortedColumns.findIndex((c) => c.id === overColumnId);
      if (doneIndex !== -1 && newIndex >= doneIndex) newIndex = doneIndex - 1;

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sortedColumns, oldIndex, newIndex);
      // Stamp new order values immediately so col.order stays in sync with
      // array position — prevents stale values from fighting index-based colors.
      const withOrders = reordered.map((col, idx) => ({ ...col, order: idx }));

      onColumnsChange(withOrders);

      fetch("/api/columns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: withOrders.map((col) => ({ id: col.id, order: col.order })) }),
      }).catch((error) => console.error("Failed to persist column order:", error));

      broadcastRefresh();
      return;
    }

    // Handle task dragging
    const task = tasksRef.current.find((t) => t.id === activeId);
    if (!task) return;

    // Determine destination column
    const overTask = tasksRef.current.find((t) => t.id === overId);
    const destColumn: string | undefined = overTask
      ? overTask.column
      : columns.find((c) => c.id === overId)?.id;
    if (!destColumn) return;

    // Reorder within column
    const columnTasks = tasksRef.current
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

    // Persist to server. Mover mismatch = current user is in none of the
    // task's assignees (server recomputes this; the hint is informational).
    const isColumnChange = task.column !== destColumn;
    const taskAssigneeIdSet = task.assignees?.length
      ? task.assignees.map((a) => a.id)
      : task.assigneeId
      ? [task.assigneeId]
      : [];
    const isMoverMismatch =
      isColumnChange &&
      taskAssigneeIdSet.length > 0 &&
      !!currentUserId &&
      !taskAssigneeIdSet.includes(currentUserId);

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

      // Update sibling orders only if the primary move succeeded
      const siblings = reordered.filter((t) => t.id !== activeId);
      if (siblings.length > 0) {
        fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(siblings.map((t) => ({ id: t.id, order: orderMap[t.id] }))),
        }).catch((err) => console.error("Failed to bulk update task order:", err));
      }
    } else {
      // Revert optimistic move — restore the column/order captured at drag
      // start. task.column here is the destination (handleDragOver already
      // rewrote it mid-drag), so we must use the saved origin instead.
      const origin = dragOriginRef.current;
      onTasksChange((prev) =>
        prev.map((t) =>
          t.id === activeId
            ? { ...t, column: origin?.column ?? task.column, order: origin?.order ?? task.order }
            : t
        )
      );
    }

  }, [tasks, columns, currentUserId, onTasksChange, onColumnsChange, broadcastRefresh]);

  // ── Task actions ───────────────────────────────────────────────

  const handleAddTask = useCallback(async (title: string, column: string) => {
    // Optimistic UI: insert a temporary task locally immediately
    const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const now = new Date();
    const colTasks = tasksRef.current.filter((t) => t.column === column);
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
      assignees: [],
      order: maxOrder + 1,
      priority: "medium",
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
      trackEvent("task_created");
    } catch (error) {
      console.error("Failed to add task:", error);
      onTasksChange((prev) => prev.filter((t) => t.id !== tempId));
      const is429 = error instanceof Error && error.message.includes(": 429");
      toasts.push({ title: "Could not add task", description: is429 ? "You're going too fast. Wait a moment." : "Please try again." });
    }
  }, [broadcastRefresh, onTasksChange, toasts]);

  const handleUpdateTask = useCallback(async (id: string, data: Partial<Task>): Promise<boolean> => {
    const prevTask = tasksRef.current.find((t) => t.id === id);
    // Optimistic update locally — strip client-only flags first (recordHistory
    // is not a Task field; spreading it in would leave an untyped property on
    // the task). The flag itself still needs to reach the server below.
    const { recordHistory: _recordHistory, ...optimisticData } = data as Partial<Task> & { recordHistory?: boolean };
    onTasksChange((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimisticData, updatedAt: new Date() } : t)));
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
      if (prevTask && updatedTask.column !== prevTask.column) {
        trackEvent("task_moved");
        if (!prevTask.completedAt && updatedTask.completedAt) trackEvent("task_completed");
      }
      return true;
    } catch (error) {
      console.error("Failed to update task:", error);
      if (prevTask) onTasksChange((prev) => prev.map((t) => (t.id === id ? prevTask : t)));
      const is429 = error instanceof Error && error.message.includes(": 429");
      toasts.push({ title: "Could not save changes", description: is429 ? "You're going too fast. Wait a moment." : "Please try again." });
      // Caller (e.g. TaskModal) uses this to decide whether it's safe to
      // advance its own "already saved" baselines — this function already
      // handles its own UI recovery (revert + toast), so callers should not
      // also throw/toast on this failure, just skip their success bookkeeping.
      return false;
    }
  }, [broadcastRefresh, onTasksChange, toasts]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const prevTask = tasksRef.current.find((t) => t.id === id);
    if (!prevTask) return;

    // Optimistic removal
    onTasksChange((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
      broadcastRefresh({ type: "task:delete", taskId: id });

      // Show undo toast. Soft delete means restore brings back the exact same
      // task (comments, assignees, history, id) rather than recreating a copy.
      toasts.push({
        title: "Task deleted",
        description: prevTask.title,
        actionLabel: "Undo",
        onAction: async () => {
          try {
            const r = await fetch(`/api/tasks/${id}/restore`, { method: "POST" });
            if (!r.ok) throw new Error("Restore failed");
            const restored = await r.json();
            const withDisplay = { ...restored, assigneeUser: restored.assigneeUser ?? prevTask.assigneeUser ?? null };
            onTasksChange((prev) => (prev.some((t) => t.id === restored.id) ? prev : [...prev, withDisplay]));
            broadcastRefresh({ type: "task:create", task: withDisplay });
          } catch (err) {
            console.error("Undo restore failed", err);
            toasts.push({ title: "Couldn't undo", description: "Please try again." });
          }
        },
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
      // rollback optimistic removal on failure
      onTasksChange((prev) => (prevTask ? [...prev, prevTask] : prev));
    }
  }, [broadcastRefresh, onTasksChange, toasts]);

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
          t.id === taskId
            ? { ...t, comments: [...(t.comments ?? []), comment], commentCount: (t.commentCount ?? 0) + 1 }
            : t
        )
      );
      broadcastRefresh();
      return comment;
    },
    [broadcastRefresh, onTasksChange]
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
    // Desktop-only: drag empty space to pan columns. Skip on touch devices —
    // native scrolling already handles panning there, and synthetic mouse events
    // from taps would otherwise jump the board to an edge.
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return;
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
      {/* ── Mobile header ── */}
      <div className="md:hidden flex-shrink-0 flex items-center gap-2 px-4 pt-4 pb-3.5 border-b border-border/60">
        {onOpenNav && (
          <button
            onClick={onOpenNav}
            aria-label="Open menu"
            className="flex items-center justify-center w-8 h-8 -ml-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          {headerTitle ?? (
            onOpenSettings ? (
              <BoardHeaderMenu boardId={boardId} boardName={boardName ?? ""} currentUserId={currentUserId} onOpenSettings={onOpenSettings} onOpenAnalytics={onOpenAnalytics} variant="mobile" />
            ) : (
              <h1 className="text-base font-bold tracking-tight text-ink truncate">{boardName || "Board"}</h1>
            )
          )}
        </div>
        <div className={`flex items-center gap-1.5 flex-shrink-0 ${selectedTask ? "invisible pointer-events-none" : ""}`}>
          {/* View mode toggle */}
          <div ref={toggleRef} className="relative flex items-center gap-0.5 px-0.5 py-0.5 bg-column-bg rounded-lg border border-border/30">
            <div
              aria-hidden
              style={{ left: `${sliderPos.left}px`, width: `${sliderPos.width}px` }}
              className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md bg-ink/10 transition-all duration-180 ease-out pointer-events-none"
            />
            <button
              ref={boardBtnRef}
              onClick={() => setViewMode("board")}
              aria-label="Board view"
              className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "board" ? "text-ink/90" : "text-muted/70"}`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ display: "block" }}>
                <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/>
                <rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/>
              </svg>
            </button>
            <button
              ref={listBtnRef}
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "list" ? "text-ink/90" : "text-muted/70"}`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: "block" }}>
                <line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="2" y1="7" x2="12" y2="7"/><line x1="2" y1="10.5" x2="12" y2="10.5"/>
              </svg>
            </button>
          </div>
          {/* Search / filter icon */}
          <button
            onClick={() => setMobileFilterOpen((v) => !v)}
            aria-label="Search and filter"
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
              mobileFilterOpen ? "bg-ink/8 border-border text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          {canViewTrash && (
            <button
              onClick={() => setTrashOpen(true)}
              aria-label="Recently deleted"
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-transparent text-muted hover:text-ink transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
        {headerTrailing}
      </div>

      {/* Mobile filter bar (expands below header) */}
      {mobileFilterOpen && (
        <div className="md:hidden px-4 pb-3 pt-2 border-b border-border/60">
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
            tags={allBoardTags}
            totalTasks={tasks.length}
            filteredTasksCount={filteredTasks.length}
          />
        </div>
      )}

      {/* ── Desktop header ── */}
      <div className="hidden md:flex flex-shrink-0 items-center gap-4 px-10 pt-6 pb-5 border-b border-border/60">
        {headerTitle ?? (
          onOpenSettings ? (
            <BoardHeaderMenu boardId={boardId} boardName={boardName ?? ""} currentUserId={currentUserId} onOpenSettings={onOpenSettings} onOpenAnalytics={onOpenAnalytics} variant="desktop" />
          ) : (
            <h1 className="text-xl font-bold tracking-tight text-ink shrink-0">{boardName || "Board"}</h1>
          )
        )}
        {/* When task side-panel is open, hide controls but keep height stable */}
        <div className={`flex items-center gap-4 flex-1 min-w-0 ${selectedTask ? "invisible pointer-events-none" : ""}`}>
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
            tags={allBoardTags}
            totalTasks={tasks.length}
            filteredTasksCount={filteredTasks.length}
          />
          {/* View mode toggle (animated slider) */}
          <div ref={desktopToggleRef} className="relative flex items-center gap-1 px-1 py-1 bg-column-bg rounded-lg border border-border/30 flex-shrink-0">
            <div
              aria-hidden
              style={{ left: `${desktopSliderPos.left}px`, width: `${desktopSliderPos.width}px` }}
              className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md bg-ink/10 transition-all duration-180 ease-out pointer-events-none"
            />
            <button
              ref={desktopBoardBtnRef}
              onClick={() => setViewMode("board")}
              title="Board view"
              aria-label="Board view"
              className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "board" ? "text-ink/90" : "text-muted/70 hover:text-ink/80"}`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ display: "block" }}>
                <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/>
                <rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/>
              </svg>
            </button>
            <button
              ref={desktopListBtnRef}
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
              className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "list" ? "text-ink/90" : "text-muted/70 hover:text-ink/80"}`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: "block" }}>
                <line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="2" y1="7" x2="12" y2="7"/><line x1="2" y1="10.5" x2="12" y2="10.5"/>
              </svg>
            </button>
          </div>
          {canViewTrash && (
            <button
              onClick={() => setTrashOpen(true)}
              title="Recently deleted"
              aria-label="Recently deleted"
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-border/30 bg-column-bg text-muted/70 hover:text-ink/80 transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
        {headerTrailing}
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
            <SortableContext items={sortedColumns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-7 min-h-full pb-8 px-4 md:px-10 pt-6">
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
              sortedColumns.map((col, index) => (
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
                  color={col.color}
                  onSetColor={handleSetColumnColor}
                  isDynamic={columns.length > 1}
                  isBoardEmpty={tasks.length === 0}
                />
              ))
            )}

            {/* Add column button */}
            <div className="flex-shrink-0 w-[72vw] md:w-80 flex items-start">
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
            {activeColumn && (() => {
              const dragIdx = sortedColumns.findIndex((c) => c.id === activeColumn.id);
              const dragColors = resolveColumnPalette(activeColumn.color, dragIdx);
              return (
                <div className={`w-[72vw] md:w-80 rounded-lg border-2 shadow-xl opacity-95 pointer-events-none scale-105 ${dragColors.bg} ${dragColors.border}`}>
                  <div className={`p-3 font-bold text-sm ${dragColors.text}`}>{activeColumn.label}</div>
                  <div className="px-3 pb-3 text-xs text-muted">
                    {getTasksByColumn(activeColumn.id).length} tasks
                  </div>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>
      </div>
      )}

      <TaskModal
        task={selectedTask}
        boardId={boardId}
        boardMembers={boardMembers}
        columns={sortedColumns}
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

      {canViewTrash && (
        <TrashPanel
          boardId={boardId}
          isOpen={trashOpen}
          onClose={() => setTrashOpen(false)}
          onRestored={(task) =>
            onTasksChange((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
          }
        />
      )}
    </>
  );
}
