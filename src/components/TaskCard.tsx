"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect } from "react";
import { Task } from "@/lib/types";
import { formatDeadlineLabel } from "@/lib/utils";
import { getPriorityConfig } from "@/lib/priority";
import PriorityIcon from "./PriorityIcon";
import Avatar from "./Avatar";

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
    transition: transition ?? "transform var(--motion-default) var(--motion-ease), box-shadow var(--motion-default) var(--motion-ease), border-color calc(var(--motion-default) - 40ms) ease",
    // Only promote to a compositor layer while the card is actively moving.
    // Keeping willChange: "transform" on every card at rest wastes GPU memory.
    willChange: (isDragging || !!transform) ? "transform" : "auto",
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  } as React.CSSProperties;

  const deadlineInfo = formatDeadlineLabel(task.deadline, task.completedAt);
  const overdue = deadlineInfo.severity === "overdue";

  // commentCount is kept in sync by Board.handleAddComment; fall back to array length only if absent
  const commentCount = task.commentCount ?? task.comments?.length ?? 0;

  const priorityLabel: Record<string, string> = {
    low: "Low", medium: "Med", high: "High", urgent: "URGENT",
  };
  const p = task.priority ?? "medium";

  // Full assignee set; fall back to the legacy single assignee shape
  const assignees = task.assignees?.length
    ? task.assignees
    : task.assigneeUser
    ? [task.assigneeUser]
    : [];

  const rootClass = `group relative bg-card-bg rounded-2xl px-4 py-4 shadow-card hover:shadow-card-hover hover:-translate-y-1 cursor-pointer select-none border border-transparent hover:border-border`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(mounted ? attributes : {})}
      {...(mounted ? listeners : {})}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Open task: ${task.title}`}
      data-task
      className={rootClass}
    >

      <p className="text-sm font-medium text-ink leading-snug tracking-[-0.01em] pr-3 break-words">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none text-ink border border-border/60"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${getPriorityConfig(p).text}`}>
          <PriorityIcon priority={p} className="w-3 h-3" />
          {priorityLabel[p]}
        </span>

{/* Deadline badge */}
        {deadlineInfo.severity !== "none" && (
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${
            deadlineInfo.severity === "overdue"
              ? "text-red-600 dark:text-red-400"
              : deadlineInfo.severity === "due-soon"
              ? "text-orange-500 dark:text-orange-400"
              : "text-muted"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${deadlineInfo.severity === "overdue" ? "bg-red-500" : deadlineInfo.severity === "due-soon" ? "bg-orange-500" : "bg-muted/30"}`} />
            {deadlineInfo.label}
          </span>
        )}

        {assignees.length > 0 && (
          <>
            <span className="text-muted text-xs">·</span>
            <div className="flex items-center flex-shrink-0">
              {assignees.slice(0, 3).map((a, i) => (
                <div key={a.id} className={`relative group/avatar hover:z-10 ${i > 0 ? "-ml-1" : ""}`}>
                  <Avatar name={a.name} color={a.color} size="xs" className="shadow-sm ring-1 ring-card-bg" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150">
                    <div className="flex items-center gap-2 bg-[#1C1917] border border-white/10 rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
                      <Avatar name={a.name} color={a.color} size="lg" />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-white leading-tight">{a.name}</span>
                        {a.handle && (
                          <span className="text-[11px] text-white/50 leading-tight">@{a.handle}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {assignees.length > 3 && (
                <span className="-ml-1 flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold bg-muted/30 text-ink ring-1 ring-card-bg">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          </>
        )}

        {commentCount > 0 && (
          <>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted">
              {commentCount} {commentCount === 1 ? "note" : "notes"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Memoize on task data only. KanbanColumn passes an inline arrow `() => onTaskClick(task)` which
// is always a new reference — comparing onClick would defeat the memo on every render.
const tagsDigest = (tags: Task["tags"]) =>
  (tags ?? []).map((t) => `${t.id}|${t.name}|${t.color}`).join(",");
const assigneeUserDigest = (u: Task["assigneeUser"]) =>
  u ? `${u.color}|${u.name}|${u.handle ?? ""}` : "";
const assigneesDigest = (list: Task["assignees"]) =>
  (list ?? []).map((a) => `${a.id}|${a.color}|${a.name}`).join(",");

export default memo(TaskCard, (prev, next) => {
  const prevCount = (prev.task.comments && prev.task.comments.length) || (prev.task as any).commentCount || ((prev.task as any)._count?.comments) || 0;
  const nextCount = (next.task.comments && next.task.comments.length) || (next.task as any).commentCount || ((next.task as any)._count?.comments) || 0;
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.priority === next.task.priority &&
    prev.task.column === next.task.column &&
    prev.task.assigneeId === next.task.assigneeId &&
    prev.task.deadline === next.task.deadline &&
    prev.task.columnUpdatedAt === next.task.columnUpdatedAt &&
    prev.task.completedAt === next.task.completedAt &&
    prevCount === nextCount &&
    tagsDigest(prev.task.tags) === tagsDigest(next.task.tags) &&
    assigneeUserDigest(prev.task.assigneeUser) === assigneeUserDigest(next.task.assigneeUser) &&
    assigneesDigest(prev.task.assignees) === assigneesDigest(next.task.assignees)
  );
});
