"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useRef, useCallback } from "react";
import { Task } from "@/lib/types";
import { timeInColumn, isOverdue } from "@/lib/utils";

interface Props {
  task: Task;
  onClick: () => void;
  onTitleUpdate: (id: string, title: string) => Promise<void>;
}

export default function TaskCard({ task, onClick, onTitleUpdate }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreBlurRef = useRef(false);
  const submittingRef = useRef(false);
  const lastSubmittedRef = useRef<string | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isEditing });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(task.title);
      lastSubmittedRef.current = null;
    }
  }, [task.title, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitTitle = useCallback(async () => {
    if (submittingRef.current) return;
    const trimmed = draftTitle.trim();

    if (!trimmed) {
      setDraftTitle(task.title);
      setIsEditing(false);
      return;
    }

    if (trimmed === task.title || trimmed === lastSubmittedRef.current) {
      setIsEditing(false);
      return;
    }

    submittingRef.current = true;
    lastSubmittedRef.current = trimmed;
    await onTitleUpdate(task.id, trimmed);
    submittingRef.current = false;
    setIsEditing(false);
  }, [draftTitle, onTitleUpdate, task.id, task.title]);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitle();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      ignoreBlurRef.current = true;
      setDraftTitle(task.title);
      setIsEditing(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const overdue = isOverdue(task.deadline);
  const timeStr = mounted ? timeInColumn(task.columnUpdatedAt) : "";

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

      {isEditing ? (
        <input
          ref={inputRef}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          onBlur={() => {
            if (ignoreBlurRef.current) {
              ignoreBlurRef.current = false;
              return;
            }
            commitTitle();
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-sm font-medium text-ink leading-snug pr-3 bg-black/10 rounded-lg px-[3px] py-[1px] outline-none border-none shadow-none ring-0 appearance-none w-full"
        />
      ) : (
        <p
          className="text-sm font-medium text-ink leading-snug pr-3"
          onClick={handleTitleClick}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {task.title}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2.5">
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
