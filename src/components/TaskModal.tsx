"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Task, Comment, TaskActivity } from "@/lib/types";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false, loading: () => null });
const DiffViewer = dynamic(() => import("./DiffViewer"), { ssr: false, loading: () => null });
const LazyMarkdown = dynamic(() => import("./LazyMarkdown"), { ssr: false, loading: () => null });
import {
  isOverdue,
  formatDateForInput,
  formatDateTime,
  formatTimeAgo,
  formatDeadlineLabel,
  dateInputToISOString,
} from "@/lib/utils";
import useBoardResources from "@/hooks/useBoardResources";

interface Props {
  task: Task | null;
  boardMembers?: import("@/lib/types").BoardMemberData[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (taskId: string, content: string, author: string) => Promise<Comment>;
  boardId: string;
  onBroadcast?: () => void;
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

export default function TaskModal({ 
  task, 
  boardMembers = [], 
  onClose, 
  onUpdate, 
  onDelete, 
  onAddComment, 
  boardId,
  onBroadcast
}: Props) {
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
  const [viewMode, setViewMode] = useState<"comments" | "activity" | "history">("comments");
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<import("@/lib/types").Tag | null>(null);

  const { tags: allBoardTags, setTagsForBoard } = useBoardResources(boardId);
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
    if (!task) return;
    
    // Always sync comments and activities from props
    setComments(task.comments ?? []);
    setActivities(task.activities ?? []);
    setPriority(task.priority ?? "medium");

    // Only sync draft-related fields when switching tasks to avoid overwriting active edits
    if (task.id !== prevTask.current) {
      prevTask.current = task.id;
      userHasEdited.current = false;
      setDescription(task.description ?? "");
      setIsEditingDescription(false);
      setIsEditingTitle(false);
      setShowInfo(false);
      setDraftTitle(task.title);
      setAssigneeId(task.assigneeId ?? "");
      setDeadline(formatDateForInput(task.deadline));
      
      originalTask.current = {
        description: task.description ?? "",
        assigneeId: task.assigneeId,
        deadline: formatDateForInput(task.deadline),
      };

      // Lazy-load activities when opening a new task (not included in the board list fetch)
      if (!task.activities || task.activities.length === 0) {
        fetch(`/api/tasks/${task.id}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.activities) setActivities(data.activities); })
          .catch(() => {});
      }
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

  const fetchVersions = useCallback(async () => {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}/versions`);
    if (res.ok) {
      const data = await res.json();
      setVersions(data);
    }
  }, [task]);

  useEffect(() => {
    if (viewMode === "history") {
      fetchVersions();
    }
  }, [viewMode, fetchVersions]);



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

  // Tags are provided from shared `useBoardResources` hook to avoid duplicate fetches.

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
    if (!task) return;
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    setSaving(true);
    try {
      await onUpdate(id, data);
    } finally {
      if (!isMounted.current) return;
      savingTimeoutRef.current = setTimeout(() => setSaving(false), 400);
    }
  }, [onUpdate, task]);

  useEffect(() => {
    if (!task) return;
    if (debouncedAssigneeId !== originalTask.current?.assigneeId) {
      handleUpdateWithFeedback(task.id, { assigneeId: debouncedAssigneeId === "" ? null : debouncedAssigneeId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssigneeId]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    const deadlineValue = debouncedDeadline ? dateInputToISOString(debouncedDeadline) : null;
    const originalDeadline = originalTask.current?.deadline 
      ? dateInputToISOString(originalTask.current.deadline)
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
    const deadlineValue = deadline ? dateInputToISOString(deadline) : null;
    const originalDeadline = originalTask.current?.deadline 
      ? dateInputToISOString(originalTask.current.deadline)
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
    setConfirmDelete(false);
    setTagToDelete(null);
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
    try {
      const newComment = await onAddComment(task.id, trimmed, commentAuthor.trim());
      setComments((prev) => [...prev, newComment]);
      
      // Fetch fresh task data to update activities feed
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const freshTask = await res.json();
        setActivities(freshTask.activities || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingComment(false);
    }
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
    await handleUpdateWithFeedback(task.id, { tagIds: newIds } as any);
    
    // Immediately fetch fresh activities to reflect the tag change in the log
    const res = await fetch(`/api/tasks/${task.id}`);
    if (res.ok) {
      const freshTask = await res.json();
      setActivities(freshTask.activities || []);
    }
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
        // Update shared cache so other components see the new tag without refetch.
        setTagsForBoard((prev) => [...(prev || []), created]);
        setNewTagName("");
        setIsCreatingTag(false);
        // Automatically assign the new tag to the task
        await toggleTag(created.id);
        onBroadcast?.();
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const handleDeleteTag = (e: React.MouseEvent, tag: import("@/lib/types").Tag) => {
    e.stopPropagation();
    setTagDropdownOpen(false);
    setIsCreatingTag(false);
    setConfirmDelete(false);
    setTagToDelete(tag);
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      const res = await fetch(`/api/tags/${tagToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setTagsForBoard((prev) => (prev || []).filter((t) => t.id !== tagToDelete.id));
        if (task) await onUpdate(task.id, {});
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
    } finally {
      setTagToDelete(null);
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

  const overdue = isOverdue(task.deadline, task.completedAt);
  // derive semantic deadline info from the local `deadline` input (shows unsaved edits)
  const deadlineInfo = formatDeadlineLabel(deadline ? dateInputToISOString(deadline) : null, task.completedAt);

  // decide whether to show a muted 'future' status: show only for deadlines within the next 7 days
  let showDeadlineStatus = false;
  if (deadline && !task.completedAt && deadlineInfo.severity !== "none") {
    if (deadlineInfo.severity === "overdue" || deadlineInfo.severity === "due-soon") {
      showDeadlineStatus = true;
    } else if (deadlineInfo.severity === "future") {
      const nowDate = new Date();
      const d = new Date(deadline);
      const startOfToday = new Date(nowDate);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfDeadlineDay = new Date(d);
      startOfDeadlineDay.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((startOfDeadlineDay.getTime() - startOfToday.getTime()) / 86_400_000);
      showDeadlineStatus = daysUntil <= 7;
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] animate-fade-in"
    >
      <div className="relative bg-card-bg sm:rounded-2xl shadow-modal w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-modal-in overflow-hidden">

        {/* Delete confirmation overlay */}
        {confirmDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center sm:rounded-2xl bg-ink/20 backdrop-blur-[2px] animate-fade-in">
            <div className="bg-card-bg sm:rounded-2xl shadow-modal border border-border w-72 sm:w-64 p-6 flex flex-col gap-4 animate-modal-in">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-ink">Delete this task?</p>
                <p className="text-xs text-muted">This action cannot be undone.</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onDelete(task.id); handleClose(); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {tagToDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center sm:rounded-2xl bg-ink/20 backdrop-blur-[2px] animate-fade-in">
            <div className="bg-card-bg sm:rounded-2xl shadow-modal border border-border w-72 sm:w-64 p-6 flex flex-col gap-4 animate-modal-in">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-ink">Delete this tag?</p>
                <p className="text-xs text-muted">This removes it from all tasks on this board.</p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setTagToDelete(null)}
                  className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-column-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteTag}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

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
                className="flex-1 text-base font-semibold text-ink leading-snug bg-column-bg rounded-lg px-2 py-0.5 outline-none border-none shadow-none ring-0 appearance-none"
              />
            ) : (
              <h2
                className="text-base font-semibold text-ink leading-snug flex-1 cursor-text rounded-lg px-2 py-0.5 -mx-2 hover:bg-column-bg transition-colors"
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
                onClick={() => { setTagToDelete(null); setConfirmDelete(true); }}
                className="p-2 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
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
              {/* overdue label moved to a more prominent header badge */}
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
                  className="px-2 py-1 rounded-lg text-xs font-bold text-white shadow-sm hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: tag.color }}
                  title="Click to remove"
                >
                  {tag.name}
                </button>
              ))}
              <button
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className="w-8 h-8 rounded-lg bg-column-bg flex items-center justify-center text-muted hover:text-ink hover:bg-border transition-colors"
                title="Manage tags"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 3v8M3 7h8"/>
                </svg>
              </button>
            </div>

            {tagDropdownOpen && (
              <div className="absolute z-10 mt-1 w-64 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {allBoardTags.length === 0 && !isCreatingTag && (
                    <p className="px-3 py-4 text-center text-xs text-muted">No tags found.</p>
                  )}
                  {allBoardTags.map((tag) => {
                    const isSelected = task.tags?.some((t) => t.id === tag.id);
                    return (
                      <div
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-column-bg text-ink font-medium"
                            : "text-ink hover:bg-column-bg"
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="truncate">{tag.name}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                          <button
                            onClick={(e) => handleDeleteTag(e, tag)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
            <div ref={assigneeDropdownRef} className="relative">
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                Assignee
              </label>
              {/* Custom assignee dropdown trigger */}
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen((v) => !v)}
                className="
                  w-full bg-column-bg rounded-xl px-4 py-3
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
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
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
              {showDeadlineStatus && (
                <p className={`mt-1 flex items-center gap-2 text-xs ${
                  deadlineInfo.severity === "overdue"
                    ? "text-red-600 dark:text-red-400"
                    : deadlineInfo.severity === "due-soon"
                    ? "text-orange-500 dark:text-orange-400"
                    : "text-muted"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    deadlineInfo.severity === "overdue"
                      ? "bg-red-500"
                      : deadlineInfo.severity === "due-soon"
                      ? "bg-orange-500"
                      : "bg-muted/40"
                  }`} />
                  {deadlineInfo.label}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Description
            </label>
            {isEditingDescription ? (
              <div className="space-y-3">
                <RichTextEditor
                  content={description}
                  onChange={(val) => {
                    userHasEdited.current = true;
                    setDescription(val);
                  }}
                  placeholder="Add a detailed description…"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setDescription(descriptionOriginalRef.current);
                      setIsEditingDescription(false);
                    }}
                    className="text-xs font-bold text-muted hover:text-ink px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="text-xs font-bold bg-ink text-paper px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  descriptionOriginalRef.current = description;
                  setIsEditingDescription(true);
                }}
                className="
                  min-h-[4rem] px-4 py-3 rounded-xl cursor-text 
                  bg-column-bg hover:bg-black/[0.05] transition-colors text-ink
                  prose prose-sm dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:mb-2 prose-p:leading-relaxed
                  prose-pre:bg-black/10 prose-pre:p-3 prose-pre:rounded-lg
                "
              >
                {description ? (
                  <LazyMarkdown content={description} />
                ) : (
                  <span className="text-muted italic">Add a description…</span>
                )}
              </div>
            )}
          </div>

          {/* Comments Section Divider */}
          <div className="border-t border-border pt-8" />          {/* Tabs for Comments vs Activity */}
          <div className="flex items-center gap-6 border-b border-border mb-4">
            <button
              onClick={() => setViewMode("comments")}
              className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors relative ${
                viewMode === "comments" ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              Comments {comments.length > 0 && <span className="normal-case font-normal text-muted ml-1">({comments.length})</span>}
              {viewMode === "comments" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
            <button
              onClick={() => setViewMode("activity")}
              className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors relative ${
                viewMode === "activity" ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              Activity {activities.length > 0 && <span className="normal-case font-normal text-muted ml-1">({activities.length})</span>}
              {viewMode === "activity" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors relative ${
                viewMode === "history" ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              History {versions.length > 0 && <span className="normal-case font-normal text-muted ml-1">({versions.length})</span>}
              {viewMode === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />}
            </button>
          </div>

          {viewMode === "comments" ? (
            <div ref={commentsRef}>
              {comments.length > 0 && (
                <div className="space-y-3 mb-6">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-column-bg/40 rounded-lg px-3 py-2.5 border border-border/30">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: nameToColor(c.author) }}
                          >
                            {c.author.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {c.author || <span className="italic font-normal text-muted">Anonymous</span>}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-muted">
                          {formatTimeAgo(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-ink leading-relaxed pl-8">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 bg-column-bg/60 rounded-xl p-2 ring-1 ring-border/40 focus-within:ring-accent/30 transition-all">
                <input
                  ref={commentInputRef}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={handleCommentKey}
                  placeholder="Write a comment…"
                  disabled={addingComment}
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-muted border-none outline-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentInput.trim() || addingComment}
                  className="px-4 py-1.5 rounded-lg bg-ink text-paper text-xs font-bold hover:opacity-90 disabled:opacity-20 transition-all flex-shrink-0 shadow-sm"
                >
                  Post
                </button>
              </div>
            </div>
          ) : viewMode === "activity" ? (
            <div className="space-y-4 py-2">
              {activities.length === 0 && (
                <p className="text-center py-8 text-xs text-muted">No activity recorded yet.</p>
              )}
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 items-start">
                  <div 
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white shadow-sm mt-0.5"
                    style={{ backgroundColor: a.user?.color || "#cbd5e1" }}
                  >
                    {a.user?.name.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-ink truncate max-w-[120px]">{a.user?.name || "System"}</span>
                      <span className="text-xs text-muted leading-snug">{a.content}</span>
                    </div>
                    <span className="text-[10px] text-muted font-medium">{formatTimeAgo(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {versions.length === 0 && (
                <p className="text-center py-8 text-xs text-muted italic">No description history available.</p>
              )}
              {versions.map((v, idx) => {
                const nextVersion = versions[idx + 1];
                const prevContent = nextVersion ? nextVersion.content : "";
                
                return (
                  <div key={v.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: v.user.color }}
                        >
                          {v.user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-ink">{v.user.name}</span>
                        <span className="text-[10px] text-muted">updated this task</span>
                      </div>
                      <span className="text-[10px] text-muted font-mono">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    
                    <DiffViewer oldText={prevContent} newText={v.content} />
                  </div>
                );
              })}
            </div>
          )}
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
