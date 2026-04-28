"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Task, Column, Comment, ColumnData } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import TaskModal from "./TaskModal";
import TaskCard from "./TaskCard";
import DeleteColumnModal from "./DeleteColumnModal";

interface Props {
  initialTasks: Task[];
  onTasksUpdate?: (tasks: Task[]) => void;
}

export default function Board({ initialTasks, onTasksUpdate }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnData | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<ColumnData | null>(null);

  // Fetch columns on mount
  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const res = await fetch("/api/columns");
        if (res.ok) {
          const data = await res.json();
          setColumns(data);
        } else {
          console.error("Failed to fetch columns:", res.status, res.statusText);
        }
      } catch (error) {
        console.error("Failed to fetch columns:", error);
      } finally {
        setIsLoadingColumns(false);
      }
    };

    fetchColumns();
  }, []);

  // Notify parent when tasks change
  useEffect(() => {
    onTasksUpdate?.(tasks);
  }, [tasks, onTasksUpdate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getTasksByColumn = (columnId: string) =>
    tasks
      .filter((t) => t.column === columnId)
      .sort((a, b) => a.order - b.order);

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
        setColumns((prev) =>
          prev.map((col) => (col.id === columnId ? updated : col))
        );
      }
    } catch (error) {
      console.error("Failed to rename column:", error);
    }
  }, []);

  const handleDeleteColumnClick = (columnId: string) => {
    const columnData = columns.find((c) => c.id === columnId);
    if (columnData) {
      setColumnToDelete(columnData);
      setDeleteModalOpen(true);
    }
  };

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
          throw new Error(`Delete failed: ${res.status}`);
        }

        setColumns((prev) => prev.filter((col) => col.id !== columnToDelete.id));
        setDeleteModalOpen(false);
        setColumnToDelete(null);
      } catch (error) {
        console.error("Failed to delete column:", error);
        alert("Failed to delete column. Please try again.");
      }
    },
    [columnToDelete]
  );

  const handleAddColumn = useCallback(async () => {
    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New column" }),
      });

      if (res.ok) {
        const newColumn = await res.json();
        setColumns((prev) => [...prev, newColumn]);
      }
    } catch (error) {
      console.error("Failed to create column:", error);
    }
  }, []);

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
    const activeColumn = columns.find((c) => c.id === activeId);
    if (activeColumn) {
      // Column dragging doesn't need live updates like task dragging
      return;
    }

    // Otherwise, handle task dragging
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine destination column
    const overTask = tasks.find((t) => t.id === overId);
    const destColumn = overTask
      ? (overTask.column as Column)
      : (columns.find((c) => c.id === overId)?.id as Column | undefined);

    if (!destColumn || activeTask.column === destColumn) return;

    setTasks((prev) => {
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
      setColumns(reordered);

      // Persist order to server
      const updates = reordered.map((col, idx) => ({
        id: col.id,
        order: idx,
      }));

      await fetch("/api/columns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updates }),
      }).catch((error) => console.error("Failed to persist column order:", error));

      return;
    }

    // Handle task dragging
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Determine destination column
    const overTask = tasks.find((t) => t.id === overId);
    const destColumn = overTask
      ? (overTask.column as Column)
      : (columns.find((c) => c.id === overId)?.id as Column | undefined);

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

    setTasks((prev) =>
      prev.map((t) =>
        orderMap[t.id] !== undefined
          ? { ...t, order: orderMap[t.id], column: destColumn }
          : t
      )
    );

    // Persist to server
    await fetch(`/api/tasks/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column: destColumn,
        order: orderMap[activeId],
      }),
    });

    // Update sibling orders
    const siblings = reordered.filter((t) => t.id !== activeId);
    await Promise.all(
      siblings.map((t) =>
        fetch(`/api/tasks/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: orderMap[t.id] }),
        })
      )
    );
  };

  // ── Task actions ───────────────────────────────────────────────

  const handleAddTask = useCallback(async (title: string, column: Column) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, column }),
      });
      if (!res.ok) throw new Error(`Add task failed: ${res.status}`);
      const newTask: Task = await res.json();
      setTasks((prev) => [...prev, newTask]);
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  }, []);

  const handleUpdateTask = useCallback(async (id: string, data: Partial<Task>) => {
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
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? updatedTask : t))
      );
      setSelectedTask((prev) => (prev?.id === id ? updatedTask : prev));
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }, []);

  const handleUpdateTaskTitle = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t))
    );
    setSelectedTask((prev) => (prev?.id === id ? { ...prev, title: trimmed } : prev));

    await handleUpdateTask(id, { title: trimmed });
  }, [handleUpdateTask]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }, []);

  const handleAddComment = useCallback(
    async (taskId: string, content: string): Promise<Comment> => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, content }),
      });
      if (!res.ok) throw new Error(`Add comment failed: ${res.status}`);
      const comment: Comment = await res.json();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
        )
      );
      return comment;
    },
    []
  );

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  if (isLoadingColumns) {
    return <div className="text-muted text-sm">Loading board...</div>;
  }

  // Check if any columns are user-created (not default)
  const defaultColumnLabels = ["To Do", "In Progress", "Done"];
  const userCreatedColumns = columns.filter(
    (col) => !defaultColumnLabels.includes(col.label)
  );

  return (
    <>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-5 h-full">
            {columns.map((col, index) => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                columnIndex={index}
                tasks={getTasksByColumn(col.id)}
                onTaskClick={handleTaskClick}
                onAddTask={handleAddTask}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumnClick}
                isDynamic={userCreatedColumns.some((c) => c.id === col.id)}
              />
            ))}

            {/* Add column button */}
            <div className="flex-shrink-0 w-96 flex items-start">
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
              <div className="w-96 bg-white/95 rounded-lg border-2 border-blue-400 shadow-xl opacity-95 pointer-events-none scale-105">
                <div className="p-3 font-bold text-sm text-ink">{activeColumn.label}</div>
                <div className="px-3 pb-3 text-xs text-muted">
                  {getTasksByColumn(activeColumn.id).length} tasks
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAddComment={handleAddComment}
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
          }}
          onConfirmDelete={handleConfirmDeleteColumn}
        />
      )}
    </>
  );
}
