"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { Task } from "@/lib/types";
import { timeInColumn, isOverdue } from "@/lib/utils";

interface Props {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: Props) {
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
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const overdue = isOverdue(task.deadline);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="
        group relative bg-card-bg rounded-xl px-4 py-3.5
        shadow-card hover:shadow-card-hover
        cursor-pointer select-none
        transition-all duration-150
        border border-transparent hover:border-border
        animate-slide-up
      "
    >
      {/* Overdue indicator */}
      {overdue && (
        <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-accent" />
      )}

      <p className="text-sm font-medium text-ink leading-snug pr-3">
        {task.title}
      </p>

      <div className="flex items-center gap-2 mt-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
          p === "urgent" ? "bg-red-500/10 text-red-500" :
          p === "high"   ? "bg-orange-500/10 text-orange-500" :
          p === "low"    ? "bg-blue-500/10 text-blue-500" :
                           "bg-yellow-500/10 text-yellow-600"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[p]}`} />
          {priorityLabel[p]}
        </span>

        <span className="text-xs text-muted font-mono">{timeStr}</span>

        {task.assignee && (
          <>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted truncate max-w-[80px]">
              {task.assignee}
            </span>
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
