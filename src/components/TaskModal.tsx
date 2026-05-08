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
  boardMembers?: import("@/lib/types").BoardMemberData[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (taskId: string, content: string, author: string) => Promise<Comment>;
  boardId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const AVATAR_PALETTE = [
  "#4A90A4", "#7B68EE", "#E8854A", "#5BAD6F", "#D4706A",
  "#A078C8", "#4E9E8F", "#C4885A", "#6B8DD6", "#D4956A",
];
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export default function TaskModal({ task, boardMembers = [], onClose, onUpdate, onDelete, onAddComment, boardId }: Props) {
  const [, setTick] = useState(0);
  const [description, setDescription] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [commentInput, setCommentInput] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");

  const [allBoardTags, setAllBoardTags] = useState<import("@/lib/types").Tag[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#4A90A4");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("kanbedu-profile");
      if (stored) {
        const parsed = JSON.parse(stored) as { name?: string };
        if (parsed.name) setCommentAuthor(parsed.name);
      }
    } catch {
      // ignore
    }
  }, []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [addingComment, setAddingComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const descriptionOriginalRef = useRef<string>("");
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedDescription = useDebounce(description, 600);
  const debouncedAssigneeId = useDebounce(assigneeId, 600);
  const debouncedDeadline = useDebounce(deadline, 600);

  const prevTask = useRef<string | null>(null);
  const originalTask = useRef<{ description?: string; assigneeId?: string | null; deadline?: string } | null>(null);
  const isMounted = useRef(false);
  const userHasEdited = useRef(false);

  useEffect(() => {
    if (task && task.id !== prevTask.current) {
      prevTask.current = task.id;
      userHasEdited.current = false;
      setDescription(task.description ?? "");
      setIsEditingDescription(false);
      setIsEditingTitle(false);
      setShowInfo(false);
      setDraftTitle(task.title);
      setAssigneeId(task.assigneeId ?? "");
      setDeadline(formatDateForInput(task.deadline));
      setPriority(task.priority ?? "medium");
      setComments(task.comments ?? []);
      // Store original values for comparison
      originalTask.current = {
        description: task.description ?? "",
        assigneeId: task.assigneeId,
        deadline: formatDateForInput(task.deadline),
      };
    }
  }, [task]);

  // Auto-focus title input when editing
  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  const commitTitle = useCallback(async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || !task) {
      setDraftTitle(task?.title ?? "");
      setIsEditingTitle(false);
      return;
    }
    if (trimmed !== task.title) {
      await onUpdate(task.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  }, [draftTitle, task, onUpdate]);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitle();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setDraftTitle(task?.title ?? "");
      setIsEditingTitle(false);
    }
  };

  // Auto-resize textarea to full content height while editing
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

  // Close assignee dropdown on outside click
  useEffect(() => {
    if (!assigneeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [assigneeDropdownOpen]);

  // Re-render every 30s so relative timestamps stay current
  useEffect(() => {
    if (!task) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [task]);

  // Fetch all available tags for this board
  useEffect(() => {
    if (!task) return;
    fetch(`/api/tags?boardId=${boardId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAllBoardTags(data))
      .catch(() => {});
  }, [task, boardId]);

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
        setIsCreatingTag(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

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
    if (!userHasEdited.current) return;
    // Only update if value actually changed from original
    if (debouncedDescription !== originalTask.current?.description) {
      handleUpdateWithFeedback(task.id, { description: debouncedDescription });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    // Only update if value actually changed from original
    if (debouncedAssigneeId !== originalTask.current?.assigneeId) {
      handleUpdateWithFeedback(task.id, { assigneeId: debouncedAssigneeId === "" ? null : debouncedAssigneeId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssigneeId]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
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
    if (!task || !isMounted.current || !userHasEdited.current) return;

    const updates: Partial<Task> = {};
    if (description !== originalTask.current?.description) {
      updates.description = description;
    }
    if (assigneeId !== originalTask.current?.assigneeId) {
      updates.assigneeId = assigneeId === "" ? null : assigneeId;
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
  }, [task, description, assigneeId, deadline, handleUpdateWithFeedback]);

  const handleClose = useCallback(async () => {
    await flushUpdates();
    onClose();
  }, [flushUpdates, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !isEditingTitle && !isEditingDescription) handleClose();
  }, [handleClose, isEditingTitle, isEditingDescription]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleAddComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !task) return;
    setAddingComment(true);
    setCommentInput("");
    const newComment = await onAddComment(task.id, trimmed, commentAuthor.trim());
    setComments((prev) => [...prev, newComment]);
    setAddingComment(false);
  };

  const handleCommentKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddComment();
  };

  const toggleTag = async (tagId: string) => {
    if (!task) return;
    userHasEdited.current = true;
    const currentIds = task.tags?.map((t) => t.id) ?? [];
    let newIds: string[];
    if (currentIds.includes(tagId)) {
      newIds = currentIds.filter((id) => id !== tagId);
    } else {
      newIds = [...currentIds, tagId];
    }
    await handleUpdateWithFeedback(task.id, { tagIds: newIds });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || !task) return;
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newTagColor, boardId }),
      });
      if (res.ok) {
        const created = await res.json();
        setAllBoardTags((prev) => [...prev, created]);
        setNewTagName("");
        setIsCreatingTag(false);
        // Automatically assign the new tag to the task
        await toggleTag(created.id);
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const handleDeleteTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this tag from the entire board?")) return;
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (res.ok) {
        setAllBoardTags((prev) => prev.filter((t) => t.id !== tagId));
        // If the task had this tag, it will be removed on next fetch/refresh, 
        // but we should ideally update local task state too if possible.
        // For now, onUpdate handlefresh data will fix it.
        await onUpdate(task.id, {}); // Trigger refresh
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  useEffect(() => {
    const el = commentsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCommentsVisible(entry.isIntersecting),
      { root: modalBodyRef.current, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [task]);

  if (!task) return null;

  const overdue = isOverdue(task.deadline);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] animate-fade-in"
    >
      <div className="relative bg-card-bg rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col animate-modal-in overflow-hidden">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={commitTitle}
                className="flex-1 text-base font-semibold text-ink leading-snug bg-black/[0.08] rounded-lg px-2 py-0.5 outline-none border-none shadow-none ring-0 appearance-none"
              />
            ) : (
              <h2
                className="text-base font-semibold text-ink leading-snug flex-1 cursor-text rounded-lg px-2 py-0.5 -mx-2 hover:bg-black/[0.05] transition-colors"
                onClick={() => { setDraftTitle(task.title); setIsEditingTitle(true); }}
              >
                {task.title}
              </h2>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowInfo((v) => !v)}
                className={`p-2 rounded-lg transition-colors text-xs ${
                  showInfo ? "text-ink bg-column-bg" : "text-muted hover:text-ink hover:bg-column-bg"
                }`}
                title="Task info"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="6"/>
                  <path d="M7 6.5v4M7 4.5v.5"/>
                </svg>
              </button>
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

          {showInfo && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
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
          )}
        </div>

        {/* Body - scrollable */}
        <div ref={modalBodyRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "urgent"] as const).map((p) => {
                const styles = {
                  low:    { active: "bg-blue-500/25 text-blue-600 ring-1 ring-blue-500/60 font-semibold",    idle: "text-muted hover:bg-blue-500/10 hover:text-blue-500" },
                  medium: { active: "bg-yellow-500/25 text-yellow-700 ring-1 ring-yellow-500/60 font-semibold", idle: "text-muted hover:bg-yellow-500/10 hover:text-yellow-600" },
                  high:   { active: "bg-orange-500/25 text-orange-600 ring-1 ring-orange-500/60 font-semibold", idle: "text-muted hover:bg-orange-500/10 hover:text-orange-500" },
                  urgent: { active: "bg-red-500/25 text-red-600 ring-1 ring-red-500/60 font-semibold",       idle: "text-muted hover:bg-red-500/10 hover:text-red-500" },
                };
                const isActive = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setPriority(p);
                      handleUpdateWithFeedback(task.id, { priority: p });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      isActive ? styles[p].active : styles[p].idle
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>



          {/* Tags */}
          <div ref={tagDropdownRef} className="relative">
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {task.tags?.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: tag.color }}
                  title="Click to remove"
                >
                  {tag.name}
                </button>
              ))}
              <button
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className="w-7 h-7 rounded-lg bg-column-bg flex items-center justify-center text-muted hover:text-ink hover:bg-border transition-colors"
                title="Manage tags"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 3v8M3 7h8"/>
                </svg>
              </button>
            </div>

            {tagDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-card-bg border border-border rounded-xl shadow-modal z-[60] overflow-hidden">
                <div className="p-2 max-h-48 overflow-y-auto space-y-1">
                  {allBoardTags.length === 0 && !isCreatingTag && (
                    <p className="px-3 py-4 text-center text-xs text-muted">No tags found.</p>
                  )}
                  {allBoardTags.map((tag) => {
                    const isSelected = task.tags?.some((t) => t.id === tag.id);
                    return (
                      <div
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-column-bg transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="text-ink font-medium">{tag.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M3 7l3 3 5-5" />
                            </svg>
                          )}
                          <button
                            onClick={(e) => handleDeleteTag(e, tag.id)}
                            className="p-1 rounded hover:bg-accent-light text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4l-.6 7.4A1 1 0 019.4 12H4.6a1 1 0 01-1-.6L3 4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border p-2">
                  {isCreatingTag ? (
                    <div className="space-y-2 p-1">
                      <input
                        autoFocus
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name…"
                        className="w-full bg-column-bg border-none rounded-lg px-2 py-1.5 text-xs text-ink outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateTag();
                          if (e.key === "Escape") setIsCreatingTag(false);
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {["#4A90A4", "#E8854A", "#5BAD6F", "#D4706A", "#7B68EE", "#A078C8"].map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewTagColor(c)}
                              className={`w-4 h-4 rounded-full transition-transform ${newTagColor === c ? "scale-125 ring-1 ring-offset-1 ring-muted" : "hover:scale-110"}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setIsCreatingTag(false)}
                            className="text-[10px] font-bold text-muted hover:text-ink px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateTag}
                            className="text-[10px] font-bold text-ink hover:bg-column-bg px-2 py-1 rounded"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingTag(true)}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-muted hover:text-ink hover:bg-column-bg rounded-lg transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 3v8M3 7h8" />
                      </svg>
                      Create new tag
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Assignee + Deadline row */}
          <div className="grid grid-cols-2 gap-4">
            <div ref={assigneeDropdownRef} className="relative">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Assignee
              </label>
              {/* Custom assignee dropdown trigger */}
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen((v) => !v)}
                className="
                  w-full bg-column-bg rounded-xl px-3 py-2.5
                  text-sm text-ink
                  border border-transparent hover:border-border
                  transition-colors cursor-pointer text-left
                  flex items-center gap-2
                "
              >
                {(() => {
                  const m = boardMembers.find((bm) => bm.id === assigneeId);
                  if (!m) return <span className="text-muted">Unassigned</span>;
                  return (
                    <>
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{m.name}</span>
                    </>
                  );
                })()}
                <svg className="ml-auto flex-shrink-0 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>

              {/* Dropdown panel */}
              {assigneeDropdownOpen && (
                <div
                  className="absolute z-10 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {[{ id: "", name: "Unassigned", color: "" }, ...boardMembers].map((m) => {
                    const isSelected = m.id === assigneeId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          userHasEdited.current = true;
                          setAssigneeId(m.id);
                          setAssigneeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          isSelected
                            ? "bg-column-bg text-ink font-medium"
                            : "text-ink hover:bg-column-bg"
                        }`}
                      >
                        {m.id === "" ? (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full border border-border flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                          </span>
                        ) : (
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate">{m.name}</span>
                        {isSelected && (
                          <svg className="ml-auto flex-shrink-0 text-ink" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => { userHasEdited.current = true; setDeadline(e.target.value); }}
                className="
                  w-full bg-column-bg rounded-xl px-4 py-2.5
                  text-sm text-ink
                  border border-transparent focus:border-border focus:outline-none
                  transition-colors
                "
              />
            </div>
          </div>

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
                  userHasEdited.current = true;
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
                rows={4}
                className="
                  w-full bg-black/[0.08] rounded-lg px-2 py-1
                  text-sm text-ink leading-relaxed
                  border-none outline-none ring-0 shadow-none
                  resize-none overflow-hidden transition-[height]
                "
              />
            ) : (
              <div
                onClick={() => {
                  descriptionOriginalRef.current = description;
                  setIsEditingDescription(true);
                }}
                className="min-h-[2.25rem] px-2 py-1 rounded-lg text-sm leading-relaxed cursor-text bg-black/[0.05] hover:bg-black/[0.08] transition-colors text-ink"
              >
                {description
                  ? <span className="whitespace-pre-wrap">{description}</span>
                  : <span className="text-muted">Add a description…</span>}
              </div>
            )}
          </div>

          {/* Comments Section Divider */}
          <div className="border-t border-border pt-8" />

          {/* Comments */}
          <div ref={commentsRef}>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-4">
              Notes & Comments {comments.length > 0 && <span className="normal-case font-normal text-muted">({comments.length})</span>}
            </label>

            {comments.length > 0 && (
              <div className="space-y-2 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="bg-column-bg rounded-lg px-3 pt-2 pb-2.5 border border-border/50">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {c.author ? (
                          <span
                            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ backgroundColor: nameToColor(c.author) }}
                          >
                            {c.author.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-border flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted/60" />
                          </span>
                        )}
                        <span className="text-[0.919rem] font-semibold text-ink">
                          {c.author || <span className="italic font-normal text-muted">Anonymous</span>}
                        </span>
                      </div>
                      <span className="text-[0.788rem] text-muted flex-shrink-0">
                        {new Date(c.createdAt).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-ink leading-relaxed pl-8">{c.content}</p>
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

        {/* Jump to comments floating button */}
        {!commentsVisible && (
          <div className="absolute bottom-[52px] left-0 right-0 flex justify-center pointer-events-none">
            <button
              onClick={() => {
                const body = modalBodyRef.current;
                const target = commentsRef.current;
                if (body && target) {
                  body.scrollTo({
                    top: target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 16,
                    behavior: "smooth",
                  });
                }
              }}
              className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full bg-ink/80 text-paper shadow-md hover:bg-ink transition-colors"
              title="Jump to comments"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2v8M2 7l4 4 4-4"/>
              </svg>
            </button>
          </div>
        )}

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
