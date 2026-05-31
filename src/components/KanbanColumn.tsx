"use client";

import { memo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, ColumnData } from "@/lib/types";
import TaskCard from "./TaskCard";
import AddTask from "./AddTask";
import ColumnHeader from "./ColumnHeader";

interface Props {
  columnId: string;
  label: string;
  columnIndex: number;
  isDone: boolean;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (title: string, column: string) => Promise<void>;
  onRenameColumn: (columnId: string, newLabel: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => void;
  onSetDoneColumn: (columnId: string) => void;
  isDynamic?: boolean;
  isBoardEmpty?: boolean;
}

function KanbanColumn({
  columnId,
  label,
  columnIndex,
  isDone,
  tasks,
  onTaskClick,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
  onSetDoneColumn,
  isDynamic = false,
  isBoardEmpty = false,
}: Props) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: columnId });
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    isDragging,
    transform,
  } = useSortable({ id: columnId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : "transform var(--motion-default) var(--motion-ease)",
    opacity: isDragging ? 0.5 : 1,
  };

  // Stable callbacks so memoized TaskCard children don't re-render
  const handleRename = useCallback(async (newLabel: string) => {
    await onRenameColumn(columnId, newLabel);
  }, [onRenameColumn, columnId]);

  const handleDelete = useCallback(() => {
    onDeleteColumn(columnId);
  }, [onDeleteColumn, columnId]);

  const handleSetDone = useCallback(() => {
    onSetDoneColumn(columnId);
  }, [onSetDoneColumn, columnId]);

  return (
    <div
      ref={setSortableRef}
      style={style}
      {...attributes}
      className="flex flex-col min-w-0 flex-shrink-0 w-[72vw] md:w-80"
    >
      <ColumnHeader
        columnId={columnId}
        label={label}
        columnIndex={columnIndex}
        isDone={isDone}
        taskCount={tasks.length}
        onRename={handleRename}
        onDelete={handleDelete}
        onSetDone={handleSetDone}
        isDynamic={isDynamic}
        isDragging={isDragging}
        dragListeners={listeners}
      />

      {/* Drop zone */}
      <div
        ref={setDropRef}
        className={`rounded-2xl p-3 transition-colors duration-150 min-h-[120px] ${
          isOver ? "bg-accent-light" : "bg-column-bg"
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        </SortableContext>

        {isBoardEmpty && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 py-6 select-none">
            {isDone ? (
              <>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/50">
                  <path d="M4 10l4 4 8-8"/>
                </svg>
                <p className="text-xs text-muted/60 text-center leading-relaxed">Finished tasks<br/>will land here</p>
              </>
            ) : columnIndex === 0 ? (
              <>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/50">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round"/>
                </svg>
                <p className="text-xs text-muted/60 text-center leading-relaxed">Add your first task<br/>to get started</p>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted/50">
                  <path d="M4 10h12M10 4l6 6-6 6"/>
                </svg>
                <p className="text-xs text-muted/60 text-center leading-relaxed">Drag tasks here<br/>as you work</p>
              </>
            )}
          </div>
        )}

        <AddTask column={columnId} onAdd={onAddTask} />
      </div>
    </div>
  );
}

// Memoize the column itself — it re-renders only when its task list or callbacks change.
// Tasks array identity is stable (comes from useMemo in Board.tsx).
export default memo(KanbanColumn);
