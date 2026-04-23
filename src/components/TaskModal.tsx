"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Comment } from "@/lib/types";
import {
  isOverdue,
  formatDateForInput,
  formatDateTime,
  formatTimeAgo,
} from "@/lib/utils";

interface Props {
  task: Task | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<Comment>;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function TaskModal({ task, onClose, onUpdate, onDelete, onAddComment }: Props) {
  const [, setTick] = useState(0);
  const [description, setDescription] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [deadline, setDeadline] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [addingComment, setAddingComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionOriginalRef = useRef<string>("");
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedDescription = useDebounce(description, 600);
  const debouncedAssignee = useDebounce(assignee, 600);
  const debouncedDeadline = useDebounce(deadline, 600);

  const prevTask = useRef<string | null>(null);
  const originalTask = useRef<{ description?: string; assignee?: string; deadline?: string } | null>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    if (task && task.id !== prevTask.current) {
      prevTask.current = task.id;
      setDescription(task.description ?? "");
      setIsEditingDescription(false);
      setAssignee(task.assignee ?? "");
      setDeadline(formatDateForInput(task.deadline));
      setComments(task.comments ?? []);
      // Store original values for comparison
      originalTask.current = {
        description: task.description ?? "",
        assignee: task.assignee ?? "",
        deadline: formatDateForInput(task.deadline),
      };
    }
  }, [task]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = descriptionTextareaRef.current;
    if (!el || !isEditingDescription) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [description, isEditingDescription]);

  // Auto-focus and place cursor at end
  useEffect(() => {
    if (!isEditingDescription) return;
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [isEditingDescription]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    };
  }, []);

  // Re-render every 30s so relative timestamps stay current
  useEffect(() => {
    if (!task) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [task]);

  // Wrapper for onUpdate to show saving feedback
  const handleUpdateWithFeedback = useCallback(async (id: string, data: Partial<Task>) => {
    setSaving(true);
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    
    try {
      await onUpdate(id, data);
      // Keep "Saved" visible for 1.5s before clearing
      savingTimeoutRef.current = setTimeout(() => setSaving(false), 1500);
    } catch {
      setSaving(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    // Only update if value actually changed from original
    if (debouncedDescription !== originalTask.current?.description) {
      handleUpdateWithFeedback(task.id, { description: debouncedDescription });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    // Only update if value actually changed from original
    if (debouncedAssignee !== originalTask.current?.assignee) {
      handleUpdateWithFeedback(task.id, { assignee: debouncedAssignee });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssignee]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    // Only update if value actually changed from original
    const deadlineValue = debouncedDeadline ? new Date(debouncedDeadline).toISOString() : null;
    const originalDeadline = originalTask.current?.deadline 
      ? new Date(originalTask.current.deadline).toISOString()
      : null;
    if (deadlineValue !== originalDeadline) {
      handleUpdateWithFeedback(task.id, { deadline: deadlineValue } as Partial<Task>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDeadline]);

  // Flush any pending debounced updates before closing
  const flushUpdates = useCallback(async () => {
    if (!task || !isMounted.current) return;

    const updates: Partial<Task> = {};
    if (description !== originalTask.current?.description) {
      updates.description = description;
    }
    if (assignee !== originalTask.current?.assignee) {
      updates.assignee = assignee;
    }
    const deadlineValue = deadline ? new Date(deadline).toISOString() : null;
    const originalDeadline = originalTask.current?.deadline 
      ? new Date(originalTask.current.deadline).toISOString()
      : null;
    if (deadlineValue !== originalDeadline) {
      updates.deadline = deadlineValue;
    }

    // Send all pending updates
    if (Object.keys(updates).length > 0) {
      await handleUpdateWithFeedback(task.id, updates);
    }
  }, [task, description, assignee, deadline, handleUpdateWithFeedback]);

  const handleClose = useCallback(async () => {
    await flushUpdates();
    onClose();
  }, [flushUpdates, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  }, [handleClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleAddComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !task) return;
    setAddingComment(true);
    setCommentInput("");
    const newComment = await onAddComment(task.id, trimmed);
    setComments((prev) => [...prev, newComment]);
    setAddingComment(false);
  };

  const handleCommentKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddComment();
  };

  if (!task) return null;

  const overdue = isOverdue(task.deadline);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] animate-fade-in"
    >
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col animate-modal-in overflow-hidden">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink leading-snug flex-1">
              {task.title}
            </h2>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => { onDelete(task.id); handleClose(); }}
                className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent-light transition-colors text-xs"
                title="Delete task"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4l-.6 7.4A1 1 0 019.4 12H4.6a1 1 0 01-1-.6L3 4"/>
                </svg>
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l12 12M13 1L1 13"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className="text-xs text-muted">
              Created {formatDateTime(task.createdAt)}
            </span>
            <span className="text-xs text-muted">
              Updated {formatTimeAgo(
                task.updatedAt && new Date(task.updatedAt).getFullYear() > 1970
                  ? task.updatedAt
                  : task.createdAt
              )}
            </span>
            {task.completedAt && (
              <span className="text-xs text-muted">
                Completed {formatDateTime(task.completedAt)}
              </span>
            )}
            {overdue && task.deadline && (
              <span className="text-xs text-accent font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                Overdue
              </span>
            )}
          </div>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Description
            </label>
            {isEditingDescription ? (
              <textarea
                ref={descriptionTextareaRef}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onBlur={() => setIsEditingDescription(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setDescription(descriptionOriginalRef.current);
                    setIsEditingDescription(false);
                  }
                }}
                rows={1}
                className="
                  w-full bg-black/[0.08] rounded-lg px-2 py-1
                  text-sm text-ink leading-relaxed
                  border-none outline-none ring-0 shadow-none
                  resize-none overflow-hidden transition-colors
                "
              />
            ) : (
              <div
                onClick={() => {
                  descriptionOriginalRef.current = description;
                  setIsEditingDescription(true);
                }}
                className="
                  min-h-[2.25rem] px-2 py-1 rounded-lg
                  text-sm leading-relaxed cursor-text
                  bg-black/[0.05] hover:bg-black/[0.08] transition-colors
                  text-ink
                "
              >
                {description
                  ? <span className="whitespace-pre-wrap">{description}</span>
                  : <span className="text-muted">Add a description…</span>}
              </div>
            )}
          </div>

          {/* Assignee + Deadline row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Assignee
              </label>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Name…"
                className="
                  w-full bg-column-bg rounded-xl px-4 py-2.5
                  text-sm text-ink placeholder:text-muted
                  border border-transparent focus:border-border focus:outline-none
                  transition-colors
                "
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="
                  w-full bg-column-bg rounded-xl px-4 py-2.5
                  text-sm text-ink
                  border border-transparent focus:border-border focus:outline-none
                  transition-colors
                "
              />
            </div>
          </div>

          {/* Comments Section Divider */}
          <div className="border-t border-border pt-8" />

          {/* Comments */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-4">
              Notes & Comments {comments.length > 0 && <span className="normal-case font-normal text-muted">({comments.length})</span>}
            </label>

            {comments.length > 0 && (
              <div className="space-y-2 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-column-bg rounded-lg px-3.5 py-3 border border-border/50">
                    <p className="text-sm text-ink leading-relaxed">{c.content}</p>
                    <p className="text-xs text-muted mt-2">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 bg-column-bg/40 rounded-lg p-2">
              <input
                ref={commentInputRef}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={handleCommentKey}
                placeholder="Add a note…"
                disabled={addingComment}
                className="
                  flex-1 bg-transparent px-2 py-1.5
                  text-sm text-ink placeholder:text-muted
                  border-none outline-none
                  transition-colors disabled:opacity-50
                "
              />
              <button
                onClick={handleAddComment}
                disabled={!commentInput.trim() || addingComment}
                className="
                  px-3 py-1.5 rounded-md bg-ink text-paper text-xs font-medium
                  hover:bg-ink/90 disabled:opacity-30 disabled:cursor-not-allowed
                  transition-colors flex-shrink-0
                "
              >
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Footer - Auto-save status */}
        <div className="px-6 py-3 border-t border-border flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 min-h-5">
            {saving ? (
              <>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <p className="text-xs text-muted">Saving…</p>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <p className="text-xs text-muted">Saved automatically</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
