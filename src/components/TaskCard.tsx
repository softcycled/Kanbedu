"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { Task } from "@/lib/types";
import { timeInColumn, isOverdue, formatDeadlineLabel } from "@/lib/utils";

interface Props {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: Props) {
  const [mounted, setMounted] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  useEffect(() => {
    setMounted(true);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 300ms cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 300ms cubic-bezier(0.25,0.46,0.45,0.94), border-color 200ms ease",
    willChange: "transform",
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  } as React.CSSProperties;

  const overdue = isOverdue(task.deadline, task.completedAt);
  const deadlineInfo = formatDeadlineLabel(task.deadline, task.completedAt);
  const timeStr = mounted ? timeInColumn(task.columnUpdatedAt) : "";

  const priorityDot: Record<string, string> = {
    low:    "bg-blue-500",
    medium: "bg-yellow-500",
    high:   "bg-orange-500",
    urgent: "bg-red-500",
  };
  const priorityLabel: Record<string, string> = {
    low: "Low", medium: "Med", high: "High", urgent: "URGENT",
  };
  const p = task.priority ?? "medium";

  const rootClass = `group relative bg-card-bg rounded-2xl px-4 py-4 shadow-card hover:shadow-card-hover hover:-translate-y-1 cursor-pointer select-none border border-transparent hover:border-border ${deadlineInfo.severity === 'overdue' ? 'border-l-2 border-red-200' : ''}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-task
      className={rootClass}
    >
      {/* Overdue indicator */}
      {overdue && (
        <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-red-500" />
      )}

      <p className="text-sm font-medium text-ink leading-snug tracking-[-0.01em] pr-3">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
          p === "urgent" ? "bg-red-500/10 dark:bg-red-950/30 text-red-500 dark:text-red-400" :
          p === "high"   ? "bg-orange-500/10 dark:bg-orange-950/30 text-orange-500 dark:text-orange-400" :
          p === "low"    ? "bg-blue-500/10 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400" :
                           "bg-yellow-500/10 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-300"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[p]}`} />
          {priorityLabel[p]}
        </span>

        {timeStr && <span className="text-xs text-muted">{timeStr}</span>}

        {/* Deadline badge */}
        {deadlineInfo.severity !== "none" && (
          <span className={`inline-flex items-center gap-2 text-xs font-medium px-2 py-0.5 rounded-md ${
            deadlineInfo.severity === "overdue"
              ? "bg-red-500/10 text-red-600 dark:bg-red-950/30 dark:text-red-400"
              : deadlineInfo.severity === "due-soon"
              ? "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-300"
              : "text-muted"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${deadlineInfo.severity === "overdue" ? "bg-red-500" : deadlineInfo.severity === "due-soon" ? "bg-yellow-500" : "bg-muted/30"}`} />
            {deadlineInfo.label}
          </span>
        )}

        {task.assigneeUser && (
          <>
            <span className="text-muted text-xs">·</span>
            <div
              className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow-sm"
              style={{ backgroundColor: task.assigneeUser.color }}
              title={task.assigneeUser.name}
            >
              {task.assigneeUser.name.charAt(0).toUpperCase()}
            </div>
          </>
        )}

        {task.comments.length > 0 && (
          <>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted">
              {task.comments.length} {task.comments.length === 1 ? "note" : "notes"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Memoize: only re-render when task data or click handler actually changes.
// During DnD drags this prevents the entire column from re-rendering on every frame.
export default memo(TaskCard, (prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.priority === next.task.priority &&
    prev.task.column === next.task.column &&
    prev.task.assigneeId === next.task.assigneeId &&
    prev.task.deadline === next.task.deadline &&
    prev.task.columnUpdatedAt === next.task.columnUpdatedAt &&
    prev.task.completedAt === next.task.completedAt &&
    prev.task.comments.length === next.task.comments.length &&
    prev.task.tags?.length === next.task.tags?.length &&
    prev.onClick === next.onClick
  );
});
