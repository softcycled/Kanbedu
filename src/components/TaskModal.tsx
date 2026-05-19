"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { Task, Comment, TaskActivity } from "@/lib/types";
import dynamic from "next/dynamic";
const DiffViewer = dynamic(() => import("./DiffViewer"), { ssr: false, loading: () => null });
import {
  isOverdue,
  timeInColumn,
  formatDateForInput,
  formatDateTime,
  formatTimeAgo,
  formatDeadlineLabel,
  dateInputToISOString,
} from "@/lib/utils";
import useBoardResources from "@/hooks/useBoardResources";
import { LABEL_PALETTE, getTextColorForBg } from "@/lib/labelPalette";

interface Props {
  task: Task | null;
  boardMembers?: import("@/lib/types").BoardMemberData[];
  columns?: import("@/lib/types").ColumnData[];
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
  columns = [],
  onClose, 
  onUpdate, 
  onDelete, 
  onAddComment, 
  boardId,
  onBroadcast
}: Props) {
  const [, setTick] = useState(0);
  const [description, setDescription] = useState("");
  const [optimisticTitle, setOptimisticTitle] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const [columnId, setColumnId] = useState("");
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
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
  const [tagCreatePhase, setTagCreatePhase] = useState<"name" | "color" | null>(null);
  const tagQuery = newTagName.trim().toLowerCase();
  const suggestionTags = tagQuery
    ? allBoardTags.filter((t) => t.name.toLowerCase().includes(tagQuery))
    : allBoardTags;
  

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
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [scrollBtnTop, setScrollBtnTop] = useState<number | null>(null);
  const descriptionOriginalRef = useRef<string>("");
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimeoutRef = useRef<number | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const debouncedDescription = useDebounce(description, 600);
  const debouncedAssigneeId = useDebounce(assigneeId, 600);
  const debouncedDeadline = useDebounce(deadline, 600);
  const [optimisticTagIds, setOptimisticTagIds] = useState<string[] | null>(null);

  const prevTask = useRef<string | null>(null);
  const originalTask = useRef<{ description?: string; assigneeId?: string | null; deadline?: string } | null>(null);
  const isMounted = useRef(false);
  const userHasEdited = useRef(false);
  const isEditingTitleRef = useRef(isEditingTitle);
  const isEditingDescriptionRef = useRef(isEditingDescription);

  useEffect(() => {
    if (!task) return;

    // Only sync everything when switching to a new task id - otherwise do a minimal, non-destructive sync
    if (task.id !== prevTask.current) {
      prevTask.current = task.id;
      userHasEdited.current = false;
      setDescription(task.description ?? "");
      setIsEditingDescription(false);
      setIsEditingTitle(false);
      setDraftTitle(task.title);
      setOptimisticTitle(null);
      setOptimisticTagIds(null);
      setShowActivity(false);
      setShowHistory(false);
      setAssigneeId(task.assigneeId ?? "");
      setColumnId(task.column ?? "");
      setDeadline(formatDateForInput(task.deadline));

      originalTask.current = {
        description: task.description ?? "",
        assigneeId: task.assigneeId,
        deadline: formatDateForInput(task.deadline),
      };

      // sync comments/activities on first load for this task
      setComments(task.comments ?? []);
      setActivities(task.activities ?? []);

      // Lazy-load activities and comments when opening a new task (not included in the board list fetch)
      if (!task.activities || task.activities.length === 0 || task.comments === undefined) {
        // Request activities and comments explicitly to avoid fetching heavy relations by default
        fetch(`/api/tasks/${task.id}?include=activities,comments`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { 
            if (data?.activities) setActivities(data.activities); 
            if (data?.comments) setComments(data.comments);
          })
          .catch(() => {});
      }
    } else {
      // Same task id: do not clobber local edits. Only sync comments/activities when the server shows
      // new entries (compare last item id) or when we have no local content.
      const incomingComments = task.comments ?? [];
      const incomingActivities = task.activities ?? [];

      const lastIncomingCommentId = incomingComments.length ? incomingComments[incomingComments.length - 1].id : null;
      const lastLocalCommentId = comments.length ? comments[comments.length - 1].id : null;
      if ((!comments || comments.length === 0) && incomingComments.length > 0) {
        setComments(incomingComments);
      } else if (lastIncomingCommentId && lastIncomingCommentId !== lastLocalCommentId) {
        setComments(incomingComments);
      }

      const lastIncomingActivityId = incomingActivities.length ? incomingActivities[incomingActivities.length - 1].id : null;
      const lastLocalActivityId = activities.length ? activities[activities.length - 1].id : null;
      if ((!activities || activities.length === 0) && incomingActivities.length > 0) {
        setActivities(incomingActivities);
      } else if (lastIncomingActivityId && lastIncomingActivityId !== lastLocalActivityId) {
        setActivities(incomingActivities);
      }

      // keep priority and column in sync only when not actively editing them
      setPriority(task.priority ?? "medium");
      setColumnId(task.column ?? "");
      // if server-side title matches optimistic title, clear optimistic overlay
      if (optimisticTitle && task.title === optimisticTitle) setOptimisticTitle(null);
    }
  }, [task]);

  // Close column dropdown on outside click
  useEffect(() => {
    if (!columnDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setColumnDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [columnDropdownOpen]);

  // Auto-focus title input when editing
  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  // keep editing refs in sync so we can use a stable keydown handler
  useEffect(() => { isEditingTitleRef.current = isEditingTitle; }, [isEditingTitle]);
  useEffect(() => { isEditingDescriptionRef.current = isEditingDescription; }, [isEditingDescription]);

  // commit title optimistically (non-blocking)
  const commitTitle = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (!trimmed || !task) {
      setDraftTitle(task?.title ?? "");
      setIsEditingTitle(false);
      return;
    }
    if (trimmed !== task.title) {
      // show optimistic title instantly
      setOptimisticTitle(trimmed);
      // fire update in background
      void onUpdate(task.id, { title: trimmed }).catch((err) => {
        console.error("Title update failed", err);
        // clear optimistic on failure; parent fetch may also reconcile
        setOptimisticTitle(null);
      });
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
      if (savedIndicatorTimeoutRef.current) window.clearTimeout(savedIndicatorTimeoutRef.current);
    };
  }, []);

  // Auto-resize textarea for comfortable editing
  const adjustDescriptionHeight = useCallback(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    // compute useful metrics
    const cs = window.getComputedStyle(el);
    let lineHeight = parseFloat(cs.lineHeight || "");
    if (!lineHeight || Number.isNaN(lineHeight)) {
      const fontSize = parseFloat(cs.fontSize || "14");
      lineHeight = fontSize * 1.4;
    }
    const paddingTop = parseFloat(cs.paddingTop || "0") || 0;
    const paddingBottom = parseFloat(cs.paddingBottom || "0") || 0;
    const borderTop = parseFloat(cs.borderTopWidth || "0") || 0;
    const borderBottom = parseFloat(cs.borderBottomWidth || "0") || 0;

    const minLines = 10; // preferred minimum 8-12 lines
    const minHeight = Math.round(lineHeight * minLines + paddingTop + paddingBottom + borderTop + borderBottom);

    // Reset to auto then measure
    el.style.height = "auto";
    const scrollH = el.scrollHeight;
    const desired = Math.max(scrollH, minHeight);

    // cap height to avoid overflowing the modal body
    const modalAvailable = modalBodyRef.current ? Math.max(120, modalBodyRef.current.clientHeight - 120) : window.innerHeight * 0.5;
    const maxHeight = Math.max(200, modalAvailable);

    el.style.height = Math.min(desired, maxHeight) + "px";
    el.style.overflow = desired > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    if (!isEditingDescription) return;
    // focus and adjust when entering edit mode
    const el = descriptionTextareaRef.current;
    if (!el) return;
    // small delay to ensure element is rendered
    requestAnimationFrame(() => {
      adjustDescriptionHeight();
      try {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      } catch {}
    });

    const onInput = () => {
      requestAnimationFrame(adjustDescriptionHeight);
    };
    el.addEventListener("input", onInput);
    window.addEventListener("resize", onInput);
    return () => {
      el.removeEventListener("input", onInput);
      window.removeEventListener("resize", onInput);
    };
  }, [isEditingDescription, adjustDescriptionHeight]);

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
        setTagCreatePhase(null);
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
      if (!isMounted.current) return;
      // show a subtle "Saved" badge briefly
      setJustSaved(true);
      if (savedIndicatorTimeoutRef.current) window.clearTimeout(savedIndicatorTimeoutRef.current);
      savedIndicatorTimeoutRef.current = window.setTimeout(() => setJustSaved(false), 1400);
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      if (!isMounted.current) return;
      savingTimeoutRef.current = setTimeout(() => setSaving(false), 400);
    }
  }, [onUpdate, task]);

  useEffect(() => {
    if (!task) return;
    if (debouncedAssigneeId !== originalTask.current?.assigneeId) {
      void handleUpdateWithFeedback(task.id, { assigneeId: debouncedAssigneeId === "" ? null : debouncedAssigneeId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssigneeId]);

  // Auto-save description when debounced value changes
  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    if (debouncedDescription !== originalTask.current?.description) {
      void handleUpdateWithFeedback(task.id, { description: debouncedDescription } as Partial<Task>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDescription]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    const deadlineValue = debouncedDeadline ? dateInputToISOString(debouncedDeadline) : null;
    const originalDeadline = originalTask.current?.deadline 
      ? dateInputToISOString(originalTask.current.deadline)
      : null;
    if (deadlineValue !== originalDeadline) {
      void handleUpdateWithFeedback(task.id, { deadline: deadlineValue } as Partial<Task>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDeadline]);

  // Flush any pending debounced updates before closing
  const flushUpdates = useCallback(() => {
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

    // Send all pending updates in background (do not block UI/closing)
    if (Object.keys(updates).length > 0) {
      void handleUpdateWithFeedback(task.id, updates);
    }
  }, [task, description, assigneeId, deadline, handleUpdateWithFeedback]);

  const handleClose = useCallback(() => {
    setConfirmDelete(false);
    setTagToDelete(null);
    // flush in background so closing feels instant
    flushUpdates();
    onClose();
  }, [flushUpdates, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !isEditingTitleRef.current && !isEditingDescriptionRef.current) handleClose();
  }, [handleClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleAddComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !task) return;
    // optimistic UI: add a local comment and activity immediately
    setCommentInput("");
    const localId = `local-comment-${Date.now()}`;
    const optimistic: Comment = { id: localId, content: trimmed, author: commentAuthor.trim() || "Anonymous", createdAt: new Date().toISOString(), taskId: task.id };
    setComments((prev) => [...prev, optimistic]);
    setActivities((prev) => [
      ...prev,
      {
        id: `local-act-${Date.now()}`,
        type: "comment",
        content: trimmed,
        userId: "",
        taskId: task.id,
        createdAt: new Date().toISOString(),
        user: { id: "", name: commentAuthor.trim() || "You", color: nameToColor(commentAuthor.trim() || "You") },
      },
    ]);

    // fire server request in background and reconcile when it completes
    void onAddComment(task.id, trimmed, commentAuthor.trim()).then((serverComment) => {
      setComments((prev) => prev.map((c) => (c.id === localId ? serverComment : c)));
    }).catch((err) => {
      console.error(err);
      setComments((prev) => prev.filter((c) => c.id !== localId));
    });
  };

  const handleCommentKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddComment();
  };

  const toggleTag = async (tagId: string) => {
    if (!task) return;
    // optimistic tag toggle
    userHasEdited.current = true;
    const base = optimisticTagIds ?? (task.tags?.map((t) => t.id) ?? []);
    const newIds = base.includes(tagId) ? base.filter((id) => id !== tagId) : [...base, tagId];
    setOptimisticTagIds(newIds);

    // add optimistic activity entry
    const tagObj = allBoardTags.find((t) => t.id === tagId);
    setActivities((prev) => [
      ...prev,
      {
        id: `local-act-${Date.now()}`,
        type: "tag",
        content: tagObj ? `${tagObj.name}` : "tagged",
        userId: "",
        taskId: task.id,
        createdAt: new Date().toISOString(),
        user: { id: "", name: commentAuthor || "You", color: nameToColor(commentAuthor || "You") },
      },
    ]);

    // fire the update in background (do not await to keep UI snappy)
    void handleUpdateWithFeedback(task.id, { tagIds: newIds } as any);
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
        setTagCreatePhase(null);
        // Automatically assign the new tag to the task (non-blocking)
        toggleTag(created.id);
        onBroadcast?.();
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

    const handleCreateTagWithColor = async (colorHex: string) => {
      const name = newTagName.trim();
      if (!name || !task) return;

      // optimistic local tag
      const tempId = `local-tag-${Date.now()}`;
      const optimisticTag = { id: tempId, name, color: colorHex } as import("@/lib/types").Tag;
      setTagsForBoard((prev) => [...(prev || []), optimisticTag]);

      // optimistically assign to task
      const base = optimisticTagIds ?? (task.tags?.map((t) => t.id) ?? []);
      const newIds = [...base, tempId];
      setOptimisticTagIds(newIds);

      setNewTagName("");
      setIsCreatingTag(false);
      setTagCreatePhase(null);

      try {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color: colorHex, boardId }),
        });
        if (res.ok) {
          const created = await res.json();
          // replace temp tag with server tag in shared cache
          setTagsForBoard((prev) => (prev || []).map((t) => (t.id === tempId ? created : t)));

          // replace temp id in optimistic tag ids and sync with server
          // use newIds (not stale closure optimisticTagIds) to avoid clearing tags
          const replaced = newIds.map((id) => (id === tempId ? created.id : id));
          setOptimisticTagIds(replaced);
          if (task) void handleUpdateWithFeedback(task.id, { tagIds: replaced } as any);
          onBroadcast?.();
        } else {
          // revert
          setTagsForBoard((prev) => (prev || []).filter((t) => t.id !== tempId));
          setOptimisticTagIds((prev) => (prev || []).filter((id) => id !== tempId));
        }
      } catch (err) {
        console.error(err);
        setTagsForBoard((prev) => (prev || []).filter((t) => t.id !== tempId));
        setOptimisticTagIds((prev) => (prev || []).filter((id) => id !== tempId));
      }
    };

  const handleDeleteTag = (e: React.MouseEvent, tag: import("@/lib/types").Tag) => {
    e.stopPropagation();
    setTagDropdownOpen(false);
    setIsCreatingTag(false);
    setTagCreatePhase(null);
    setConfirmDelete(false);
    setTagToDelete(tag);
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      const res = await fetch(`/api/tags/${tagToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setTagsForBoard((prev) => (prev || []).filter((t) => t.id !== tagToDelete.id));
        // remove optimistic assignment if present
        setOptimisticTagIds((prev) => prev ? prev.filter((id) => id !== tagToDelete.id) : prev);
        // trigger background sync for the task (non-blocking)
        if (task) void onUpdate(task.id, {});
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

  // Measure whether comments are below the fold and compute floating button position
  useLayoutEffect(() => {
    const measure = () => {
      const el = modalBodyRef.current;
      const cm = commentsRef.current;
      if (!el || !cm) {
        setShowScrollBtn(false);
        setScrollBtnTop(null);
        return;
      }

      // Use bounding rects for robust, layout-insensitive measurement
      const elRect = el.getBoundingClientRect();
      const cmRect = cm.getBoundingClientRect();

      // Show when the comments block extends below the visible bottom of the scroll container
      const shouldShow = comments.length > 0 && cmRect.bottom > elRect.bottom - 8;
      setShowScrollBtn(shouldShow);

      if (shouldShow) {
        // Position relative to the left-column container: compute comments' top offset inside that container
        const leftCol = el.parentElement || el.offsetParent || el;
        const leftRect = (leftCol as HTMLElement).getBoundingClientRect();
        const top = Math.round(cmRect.top - leftRect.top - 44); // sit slightly above the comments
        setScrollBtnTop(Math.max(8, top));
      } else {
        setScrollBtnTop(null);
      }
    };

    // Initial measure on layout
    requestAnimationFrame(measure);

    // Re-measure shortly after mount to catch late layout shifts
    const t = setTimeout(() => requestAnimationFrame(measure), 120);

    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [description, comments.length, isEditingDescription, task?.id]);

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

  const scrollToComments = () => {
    if (!modalBodyRef.current || !commentsRef.current) return;
    const top = commentsRef.current.offsetTop;
    modalBodyRef.current.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
    >
      <div className="relative bg-card-bg sm:rounded-2xl shadow-modal w-full max-w-[860px] h-full sm:h-auto sm:max-h-[90vh] flex flex-col motion-safe:animate-modal-in overflow-hidden">

        {/* Delete confirmation overlay */}
        {confirmDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center sm:rounded-2xl bg-ink/20 backdrop-blur-[2px] motion-safe:animate-fade-in">
            <div className="bg-card-bg sm:rounded-2xl shadow-modal border border-border w-72 sm:w-64 p-6 flex flex-col gap-4 motion-safe:animate-modal-in">
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
          <div className="absolute inset-0 z-20 flex items-center justify-center sm:rounded-2xl bg-ink/20 backdrop-blur-[2px] motion-safe:animate-fade-in">
            <div className="bg-card-bg sm:rounded-2xl shadow-modal border border-border w-72 sm:w-64 p-6 flex flex-col gap-4 motion-safe:animate-modal-in">
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

        {/* ── Header — action buttons only, spans full width ── */}
        <div className="flex-shrink-0 flex items-center justify-end gap-1 px-4 py-2 border-b border-border/30">
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

        {/* ── Two-column body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT COLUMN — task workspace ── */}
          <div className="relative flex flex-col border-r border-border/30" style={{ width: "58%" }}>
            <div ref={modalBodyRef} className="flex-1 overflow-y-auto px-7 py-6 space-y-4 antialiased">

              {/* Title */}
              <div>
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={commitTitle}
                    className="w-full text-[18px] font-semibold text-ink leading-snug bg-column-bg rounded-lg px-2 py-1 outline-none border-none shadow-none ring-0 appearance-none -mx-2"
                  />
                ) : (
                  <h2
                    onClick={() => { setDraftTitle(optimisticTitle ?? task.title); setIsEditingTitle(true); }}
                    className="text-[18px] font-semibold text-ink leading-snug cursor-text rounded-lg px-2 py-1 -mx-2 hover:bg-column-bg transition-colors"
                  >
                    {optimisticTitle ?? task.title}
                  </h2>
                )}
              </div>

              {/* Description */}
              <div className="pt-1">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Description
                </label>
                {isEditingDescription ? (
                  <textarea
                    ref={descriptionTextareaRef}
                    value={description}
                    onChange={(e) => { userHasEdited.current = true; setDescription(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDescription(descriptionOriginalRef.current);
                        userHasEdited.current = false;
                        setIsEditingDescription(false);
                      }
                    }}
                    onBlur={() => {
                      setIsEditingDescription(false);
                      void flushUpdates();
                    }}
                    placeholder="Write a detailed description..."
                    className="w-full min-h-[5rem] bg-column-bg rounded-lg px-3 py-2.5 text-sm text-ink border border-transparent focus:border-border/60 focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    onClick={() => {
                      descriptionOriginalRef.current = description;
                      setIsEditingDescription(true);
                    }}
                    className="min-h-[4rem] px-3 py-2.5 rounded-lg bg-column-bg/40 cursor-text hover:bg-column-bg transition-colors text-ink"
                  >
                    {description ? (
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
                        {description}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">Write a detailed description...</span>
                    )}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div ref={commentsRef} className="pt-1">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">
                  Comments{comments.length > 0 && <span className="normal-case font-normal ml-1">({comments.length})</span>}
                </label>
                {comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: nameToColor(c.author || "A") }}
                          >
                            {(c.author || "A").charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-ink">
                            {c.author || <span className="italic font-normal text-muted">Anonymous</span>}
                          </span>
                          <span className="text-[10px] text-muted">{formatTimeAgo(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-ink/80 leading-relaxed pl-7">{c.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic">No comments yet.</p>
                )}
              </div>

            </div>

            {showScrollBtn && scrollBtnTop !== null && (
              <button
                onClick={scrollToComments}
                title="Scroll to comments"
                aria-label="Scroll to comments"
                className="absolute right-4 z-10 w-8 h-8 rounded-full bg-column-bg/80 hover:bg-column-bg text-muted flex items-center justify-center shadow-sm transition-colors"
                style={{ top: scrollBtnTop }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </button>
            )}

            {/* Comment input — pinned to bottom of left column */}
            <div className="flex-shrink-0 px-7 py-4 border-t border-border/30">
              <div className="flex gap-2 bg-column-bg/60 rounded-xl p-2 ring-1 ring-border/40 focus-within:ring-accent/30 transition-all">
                <input
                  ref={commentInputRef}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={handleCommentKey}
                  placeholder="Write a comment..."
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
          </div>

          {/* ── RIGHT COLUMN — metadata panel ── */}
          <div className="flex flex-col min-h-0" style={{ width: "42%" }}>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 antialiased">

              {/* Assignee */}
              <div ref={assigneeDropdownRef} className="relative">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Assignee
                </label>
                <button
                  type="button"
                  onClick={() => setAssigneeDropdownOpen((v) => !v)}
                  className="w-full bg-column-bg rounded-xl px-4 py-2.5 text-sm text-ink border border-transparent hover:border-border transition-colors cursor-pointer text-left flex items-center gap-2"
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
                {assigneeDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
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
                            isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
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

              {/* Phase */}
              <div ref={columnDropdownRef} className="relative">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Phase
                </label>
                <button
                  type="button"
                  onClick={() => setColumnDropdownOpen((v) => !v)}
                  className="w-full bg-column-bg rounded-xl px-4 py-2.5 text-sm text-ink border border-transparent hover:border-border transition-colors cursor-pointer text-left flex items-center gap-2"
                >
                  <span className="truncate">{columns.find((c) => c.id === columnId)?.label ?? "Unknown"}</span>
                  <svg className="ml-auto flex-shrink-0 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4l4 4 4-4"/>
                  </svg>
                </button>
                {columnDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                    {columns.map((c) => {
                      const isSelected = c.id === columnId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            userHasEdited.current = true;
                            setColumnId(c.id);
                            setColumnDropdownOpen(false);
                            void handleUpdateWithFeedback(task.id, { column: c.id } as Partial<Task>);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"}`}
                        >
                          <span className="truncate">{c.label}</span>
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

              {/* Priority */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Priority
                </label>
                <div className="flex gap-1.5 flex-wrap">
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
                          void handleUpdateWithFeedback(task.id, { priority: p });
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

              {/* Deadline */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Deadline
                  {overdue && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 normal-case tracking-normal">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Overdue
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => { userHasEdited.current = true; setDeadline(e.target.value); }}
                  className="w-full bg-column-bg rounded-xl px-4 py-2.5 text-sm text-ink border border-transparent focus:border-border focus:outline-none transition-colors"
                />
                {showDeadlineStatus && (
                  <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                    deadlineInfo.severity === "overdue"  ? "text-red-600 dark:text-red-400" :
                    deadlineInfo.severity === "due-soon" ? "text-orange-500 dark:text-orange-400" :
                                                           "text-muted"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      deadlineInfo.severity === "overdue"  ? "bg-red-500" :
                      deadlineInfo.severity === "due-soon" ? "bg-orange-500" : "bg-muted/40"
                    }`} />
                    {deadlineInfo.label}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div ref={tagDropdownRef} className="relative">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(allBoardTags.filter((t) => (optimisticTagIds ?? task.tags?.map((tt) => tt.id) ?? []).includes(t.id))).map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="px-2 py-0.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ backgroundColor: tag.color, color: getTextColorForBg(tag.color) }}
                      title="Click to remove"
                    >
                      {tag.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                    className="w-7 h-7 rounded-lg bg-column-bg flex items-center justify-center text-muted hover:text-ink hover:bg-column-bg/40 transition-colors"
                    title="Manage tags"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 3v8M3 7h8"/>
                    </svg>
                  </button>
                </div>

                {tagDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-56 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                    {!isCreatingTag && (
                      <div className="pb-1 max-h-56 overflow-y-auto no-scrollbar">
                        {allBoardTags.length === 0 ? (
                          <p className="px-4 py-4 text-center text-xs text-muted">No tags found.</p>
                        ) : (
                          allBoardTags.map((tag) => {
                            const isSelected = (optimisticTagIds ?? task.tags?.map((t) => t.id) ?? []).some((id) => id === tag.id);
                            return (
                              <div
                                key={tag.id}
                                onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }}
                                className={`group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                                  isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
                                }`}
                              >
                                <span className="w-2.5 h-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="truncate flex-1">{tag.name}</span>
                                <div className="ml-auto flex items-center gap-1">
                                  {isSelected && (
                                    <svg className="flex-shrink-0 text-ink group-hover:opacity-0 transition-opacity" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M2 6l3 3 5-5"/>
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
                          })
                        )}
                      </div>
                    )}

                    {isCreatingTag && tagCreatePhase === "name" && (
                      <div className="p-3">
                        <input
                          autoFocus
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Tag name…"
                          className="w-full bg-column-bg border-none rounded-md px-2 py-1 text-xs text-ink outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setIsCreatingTag(false);
                              setNewTagName("");
                              setTagCreatePhase(null);
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                            }
                          }}
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => { setIsCreatingTag(false); setNewTagName(""); setTagCreatePhase(null); }}
                            className="text-[12px] font-medium text-muted hover:text-ink px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => { if (newTagName.trim()) setTagCreatePhase("color"); }}
                            disabled={!newTagName.trim()}
                            className="text-[12px] font-semibold text-ink hover:text-ink/70 px-2 py-1 disabled:opacity-30 transition-opacity"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {isCreatingTag && tagCreatePhase === "color" && (
                      <div className="pb-1 max-h-56 overflow-y-auto no-scrollbar">
                        {LABEL_PALETTE.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleCreateTagWithColor(p.hex)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-column-bg transition-colors"
                          >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.hex }} />
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {!isCreatingTag && (
                      <div className="border-t border-border/20">
                        <button
                          onClick={() => { setIsCreatingTag(true); setTagCreatePhase("name"); }}
                          className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-muted hover:text-ink hover:bg-column-bg transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 3v8M3 7h8" />
                          </svg>
                          Create new tag
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/30" />

              {/* Info */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">
                  Info
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Created</span>
                    <span className="text-xs text-ink">{formatDateTime(task.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">In this column</span>
                    <span className="text-xs text-ink">{timeInColumn(task.columnUpdatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Last updated</span>
                    <span className="text-xs text-ink">
                      {formatTimeAgo(
                        task.updatedAt && new Date(task.updatedAt).getFullYear() > 1970
                          ? task.updatedAt
                          : task.createdAt
                      )}
                    </span>
                  </div>
                  {task.completedAt && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted">Completed</span>
                      <span className="text-xs text-ink">{formatDateTime(task.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity */}
              <div>
                <button
                  onClick={() => setShowActivity((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-ink transition-colors w-full text-left"
                >
                  <svg
                    className={`transition-transform duration-150 ${showActivity ? "rotate-90" : ""}`}
                    width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
                  >
                    <path d="M3 2l4 3-4 3"/>
                  </svg>
                  {showActivity
                    ? "Hide activity"
                    : `Show activity${activities.length > 0 ? ` (${activities.length})` : ""}`}
                </button>
                {showActivity && (
                  <div className="mt-3 space-y-3">
                    {activities.length === 0 ? (
                      <p className="text-xs text-muted italic">No activity recorded yet.</p>
                    ) : (
                      activities.map((a) => (
                        <div key={a.id} className="flex gap-2.5 items-start">
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
                            style={{ backgroundColor: a.user?.color || "#cbd5e1" }}
                          >
                            {a.user?.name.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-ink">{a.user?.name || "System"}</span>
                              <span className="text-xs text-muted leading-snug">{a.content}</span>
                            </div>
                            <span className="text-[10px] text-muted">{formatTimeAgo(a.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <button
                  onClick={() => {
                    const next = !showHistory;
                    setShowHistory(next);
                    if (next && versions.length === 0) void fetchVersions();
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-ink transition-colors w-full text-left"
                >
                  <svg
                    className={`transition-transform duration-150 ${showHistory ? "rotate-90" : ""}`}
                    width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
                  >
                    <path d="M3 2l4 3-4 3"/>
                  </svg>
                  {showHistory
                    ? "Hide history"
                    : `Show history${versions.length > 0 ? ` (${versions.length})` : ""}`}
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-5">
                    {versions.length === 0 ? (
                      <p className="text-xs text-muted italic">No description history available.</p>
                    ) : (
                      versions.map((v, idx) => {
                        const nextVersion = versions[idx + 1];
                        const prevContent = nextVersion ? nextVersion.content : "";
                        return (
                          <div key={v.id} className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                  style={{ backgroundColor: v.user.color }}
                                >
                                  {v.user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold text-ink">{v.user.name}</span>
                              </div>
                              <span className="text-[10px] text-muted">{new Date(v.createdAt).toLocaleString()}</span>
                            </div>
                            <DiffViewer oldText={prevContent} newText={v.content} />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* ── Footer — auto-save status, spans full width ── */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-h-5">
            {saving ? (
              <>
                <div className="w-1.5 h-1.5 bg-sky-300 rounded-full motion-safe:animate-pulse" />
                <p className="text-xs text-muted">Saving...</p>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <p className="text-xs text-muted">All changes saved automatically</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

