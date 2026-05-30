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
import { LABEL_PALETTE } from "@/lib/labelPalette";
import PriorityIcon from "./PriorityIcon";
import { getColumnPalette } from "@/lib/columnPalette";
import { nameToColor } from "@/lib/avatarColor";

const getColumnDot = (index: number) =>
  index < 0 ? "bg-muted" : getColumnPalette(index).dot;

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
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<import("@/lib/types").Tag | null>(null);

  const { tags: allBoardTags, setTagsForBoard } = useBoardResources(boardId);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [metaTagDropdownOpen, setMetaTagDropdownOpen] = useState(false);
  const metaTagDropdownRef = useRef<HTMLDivElement>(null);
  const [openMetaProp, setOpenMetaProp] = useState<null | "phase" | "priority" | "assignee">(null);
  const metaPhaseRef = useRef<HTMLDivElement>(null);
  const metaPriorityRef = useRef<HTMLDivElement>(null);
  const metaAssigneeRef = useRef<HTMLDivElement>(null);
  const metaDeadlineInputRef = useRef<HTMLInputElement>(null);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  // Track viewport so we render properties/meta in either the inline mobile slot or the
  // desktop right column — never both — so dropdown refs and outside-click stay correct.
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
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
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const pendingRequestsRef = useRef<{ comments?: Promise<any> | null; activities?: Promise<any> | null; versions?: Promise<any> | null }>({ comments: null, activities: null, versions: null });
  const activityIdleTimerRef = useRef<number | null>(null);
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
  // Stable refs so the idle-activity timer doesn't capture stale state
  const showActivityRef = useRef(showActivity);
  const activitiesRef = useRef(activities);
  useEffect(() => { showActivityRef.current = showActivity; }, [showActivity]);
  useEffect(() => { activitiesRef.current = activities; }, [activities]);

  useEffect(() => {
    if (!task) return;

    // Only sync everything when switching to a new task id - otherwise do a minimal, non-destructive sync
    if (task.id !== prevTask.current) {
      prevTask.current = task.id;
      userHasEdited.current = false;
      // Cancel any in-flight fetches for the previous task so they don't block this task's fetches
      pendingRequestsRef.current.comments = null;
      pendingRequestsRef.current.activities = null;
      pendingRequestsRef.current.versions = null;
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

  // Do not eagerly fetch heavy relations while opening the modal. Instead:
      // - schedule a background fetch for comments (non-blocking, idle-friendly)
      // - avoid fetching activities immediately; fetch on-demand or after idle
      if (!task.activities || task.activities.length === 0) {
        // schedule an idle fallback to fetch activities after the modal settles
        if (typeof window !== "undefined") {
          if (activityIdleTimerRef.current) window.clearTimeout(activityIdleTimerRef.current);
          activityIdleTimerRef.current = window.setTimeout(() => {
            // Read current state via refs — avoids stale closure capture if the user opens
            // another task before this timer fires (and if so, fetch for that task instead).
            const currentTaskId = prevTask.current;
            if (!currentTaskId) return;
            if (!showActivityRef.current && activitiesRef.current.length === 0) {
              void fetchActivitiesForTask(currentTaskId);
            }
          }, 2500);
        }
      }

      // Schedule a non-blocking, idle-friendly comments fetch so the modal paints first
      if (!task.comments || task.comments.length === 0) {
        if (typeof window !== "undefined") {
          const run = () => { if (task) void fetchCommentsForTask(task.id); };
          if ((window as any).requestIdleCallback) {
            try { (window as any).requestIdleCallback(run, { timeout: 1000 }); } catch { setTimeout(run, 50); }
          } else {
            setTimeout(run, 50);
          }
        }
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

  // Cleanup any idle timers on unmount
  useEffect(() => {
    return () => {
      if (activityIdleTimerRef.current) window.clearTimeout(activityIdleTimerRef.current);
    };
  }, []);

  // ----- DEDUPED FETCH HELPERS (comments / activities / versions) -----
  // Each helper captures `taskId` in closure and gates the setter by comparing to
  // `prevTask.current` — the canonical current task id — so a late-resolving fetch
  // from a previous task cannot overwrite the new task's data. The finally block also
  // only clears the pending ref if it still points to this promise, so an old
  // resolution can't null out the in-flight request for the new task.
  const fetchCommentsForTask = useCallback(async (taskId?: string) => {
    if (!taskId) return null;
    if (pendingRequestsRef.current.comments) return pendingRequestsRef.current.comments;
    setCommentsLoading(true);
    let p: Promise<any>;
    p = fetch(`/api/tasks/${taskId}?include=comments`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.comments && prevTask.current === taskId) setComments(data.comments); return data; })
      .catch(() => null)
      .finally(() => {
        if (pendingRequestsRef.current.comments === p) {
          if (isMounted.current) setCommentsLoading(false);
          pendingRequestsRef.current.comments = null;
        }
      });
    pendingRequestsRef.current.comments = p;
    return p;
  }, []);

  const fetchActivitiesForTask = useCallback(async (taskId?: string) => {
    if (!taskId) return null;
    if (pendingRequestsRef.current.activities) return pendingRequestsRef.current.activities;
    setActivitiesLoading(true);
    let p: Promise<any>;
    p = fetch(`/api/tasks/${taskId}?include=activities`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.activities && prevTask.current === taskId) setActivities(data.activities); return data; })
      .catch(() => null)
      .finally(() => {
        if (pendingRequestsRef.current.activities === p) {
          if (isMounted.current) setActivitiesLoading(false);
          pendingRequestsRef.current.activities = null;
        }
      });
    pendingRequestsRef.current.activities = p;
    return p;
  }, []);

  // reuse existing fetchVersions but dedupe via the same ref
  const fetchVersionsDeduped = useCallback(async () => {
    if (!task) return null;
    const taskId = task.id;
    if (pendingRequestsRef.current.versions) return pendingRequestsRef.current.versions;
    setVersionsLoading(true);
    let p: Promise<any>;
    p = fetch(`/api/tasks/${taskId}/versions`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && prevTask.current === taskId) setVersions(data); return data; })
      .catch(() => null)
      .finally(() => {
        if (pendingRequestsRef.current.versions === p) {
          if (isMounted.current) setVersionsLoading(false);
          pendingRequestsRef.current.versions = null;
        }
      });
    pendingRequestsRef.current.versions = p;
    return p;
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

  // Close priority dropdown on outside click
  useEffect(() => {
    if (!priorityDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setPriorityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [priorityDropdownOpen]);

  // Reset closing state when a new task opens
  useEffect(() => {
    if (task) setClosing(false);
  }, [task?.id]);

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
      const targetTaskId = task.id;
      // fire update in background; clear optimistic overlay once the server confirms so it
      // doesn't sit in state indefinitely when the parent doesn't refetch.
      void onUpdate(targetTaskId, { title: trimmed })
        .then(() => {
          // Only clear if we're still viewing the same task — otherwise leave any newer
          // optimistic title alone.
          if (prevTask.current === targetTaskId) setOptimisticTitle(null);
        })
        .catch((err) => {
          console.error("Title update failed", err);
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
      if (savedIndicatorTimeoutRef.current) window.clearTimeout(savedIndicatorTimeoutRef.current);
    };
  }, []);

  // Auto-resize textarea to match content height — min-h class handles the floor
  const adjustDescriptionHeight = useCallback(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;

    // Reset to auto so scrollHeight reflects true content size
    el.style.height = "auto";
    const desired = el.scrollHeight;

    // Cap to avoid overflowing the modal body
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

  // Close meta-row tag dropdown on outside click
  useEffect(() => {
    if (!metaTagDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (metaTagDropdownRef.current && !metaTagDropdownRef.current.contains(e.target as Node)) {
        setMetaTagDropdownOpen(false);
        setIsCreatingTag(false);
        setTagCreatePhase(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [metaTagDropdownOpen]);

  // Close meta-row property dropdowns on outside click
  useEffect(() => {
    if (!openMetaProp) return;
    const openRef = openMetaProp === "phase" ? metaPhaseRef
                  : openMetaProp === "priority" ? metaPriorityRef
                  : metaAssigneeRef;
    const handler = (e: MouseEvent) => {
      if (openRef.current && !openRef.current.contains(e.target as Node)) {
        setOpenMetaProp(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMetaProp]);

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
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    if (debouncedAssigneeId !== (originalTask.current?.assigneeId ?? "")) {
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
    setClosing(true);
    // Let the slide-out animation play before unmounting via parent
    setTimeout(() => onClose(), 200);
  }, [flushUpdates, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !isEditingTitleRef.current && !isEditingDescriptionRef.current) handleClose();
  }, [handleClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap: keep Tab/Shift+Tab inside the panel
  useEffect(() => {
    const modal = modalBodyRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    if (!modal) return;
    const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    modal.addEventListener("keydown", handler);
    // Move focus into the modal on open
    const firstFocusable = modal.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();
    return () => modal.removeEventListener("keydown", handler);
  }, []);

  const handleAddComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !task) return;
    // optimistic UI: add a local comment and activity immediately
    setCommentInput("");
    const localId = `local-comment-${Date.now()}`;
    const localActId = `local-act-comment-${Date.now()}`;
    const optimistic: Comment = { id: localId, content: trimmed, author: commentAuthor.trim() || "Anonymous", createdAt: new Date().toISOString(), taskId: task.id };
    setComments((prev) => [...prev, optimistic]);
    setActivities((prev) => [
      ...prev,
      {
        id: localActId,
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
      setActivities((prev) => prev.filter((a) => a.id !== localActId));
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

  const renderPropertiesRows = (variant: "mobile" | "desktop") => {
    const tagsTopPt = variant === "mobile" ? "pt-4" : "pt-2";
    const priorityLabelClass = variant === "mobile" ? "capitalize" : "capitalize text-white";
    return (
      <>
        {/* Assignee */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="5" r="2.5"/>
            <path d="M2 13a5 5 0 0110 0"/>
          </svg>
          Assignee
        </div>
        <div ref={assigneeDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setAssigneeDropdownOpen((v) => !v)}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
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
                  <span className="truncate">{m.handle ? `@${m.handle}` : m.name}</span>
                </>
              );
            })()}
          </button>
          {assigneeDropdownOpen && (
            <div className="absolute z-10 mt-1 w-64 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
              {[{ id: "", name: "Unassigned", color: "", handle: undefined as string | null | undefined }, ...boardMembers].map((m) => {
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
                    <span className="truncate">{m.id === "" ? m.name : (m.handle ? `@${m.handle}` : m.name)}</span>
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
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 9l5-3 5 3M2 5l5-3 5 3"/>
          </svg>
          Phase
        </div>
        <div ref={columnDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnDropdownOpen((v) => !v)}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(columns.findIndex((c) => c.id === columnId))}`} />
            <span className="truncate">{columns.find((c) => c.id === columnId)?.label ?? "Unknown"}</span>
          </button>
          {columnDropdownOpen && (
            <div className="absolute z-10 mt-1 w-64 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
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
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(columns.indexOf(c))}`} />
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
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 12V9M6 12V6M10 12V3"/>
          </svg>
          Priority
        </div>
        <div ref={priorityDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setPriorityDropdownOpen((v) => !v)}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
          >
            <PriorityIcon priority={priority} className="w-3.5 h-3.5" />
            <span className={priorityLabelClass}>{priority}</span>
          </button>
          {priorityDropdownOpen && (
            <div className="absolute z-10 mt-1 w-48 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
              {(["low", "medium", "high", "urgent"] as const).map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      setPriorityDropdownOpen(false);
                      void handleUpdateWithFeedback(task.id, { priority: p });
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"}`}
                  >
                    <PriorityIcon priority={p} className="w-3.5 h-3.5" />
                    <span className="capitalize">{p}</span>
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

        {/* Deadline */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="10" height="9" rx="1.5"/>
            <path d="M5 1.5v3M9 1.5v3M2 7h10"/>
          </svg>
          Deadline
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Overdue
            </span>
          )}
        </div>
        <div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => { userHasEdited.current = true; setDeadline(e.target.value); }}
            className="-mx-2 px-2 py-1 bg-transparent text-sm text-ink rounded-md hover:bg-column-bg focus:bg-column-bg focus:outline-none transition-colors"
          />
          {showDeadlineStatus && (
            <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${
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
        <div className="flex items-center gap-1.5 text-xs text-muted self-start pt-1">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2h6.5L12 5.5V12H2z"/>
            <circle cx="5" cy="5.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
          Tags
        </div>
        <div ref={tagDropdownRef} className="relative">
          <div className={`flex flex-wrap items-center gap-1.5 -mx-1 ${tagsTopPt}`}>
            {(allBoardTags.filter((t) => (optimisticTagIds ?? task.tags?.map((tt) => tt.id) ?? []).includes(t.id))).map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium leading-none text-ink border border-border/60 hover:bg-column-bg transition-colors"
                title="Click to remove"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span>{tag.name}</span>
              </button>
            ))}
            <button
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-column-bg transition-colors"
              title="Manage tags"
              aria-label="Add tag"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
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
      </>
    );
  };

  const renderMetaPanels = (variant: "mobile" | "desktop") => {
    const infoRows = (
      <>
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
      </>
    );
    return (
      <>
        {/* Info */}
        <div>
          {variant === "mobile" ? (
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Info</label>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Info</p>
          )}
          {variant === "mobile" ? (
            <div className="space-y-2">{infoRows}</div>
          ) : (
            <div className="bg-column-bg/40 rounded-xl border border-border/30 px-4 py-3 space-y-2.5">{infoRows}</div>
          )}
        </div>

        {/* Activity */}
        <div>
          <button
            onClick={() => {
              const next = !showActivity;
              setShowActivity(next);
              if (next && activities.length === 0) void fetchActivitiesForTask(task.id);
            }}
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
              {activitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 rounded bg-column-bg/40 animate-pulse" />
                  ))}
                </div>
              ) : activities.length === 0 ? (
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
                        <span className="text-xs font-semibold text-ink">{a.user?.handle ? `@${a.user.handle}` : a.user?.name || "System"}</span>
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
              if (next && versions.length === 0) void fetchVersionsDeduped();
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
              {versionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 rounded bg-column-bg/40 animate-pulse" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
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
                          <span className="text-xs font-semibold text-ink">{v.user.handle ? `@${v.user.handle}` : v.user.name}</span>
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
      </>
    );
  };

  return (
    <div
      className="fixed inset-y-0 right-0 left-0 md:left-56 z-40 flex pointer-events-none"
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label={task?.title ?? "Task"}
        className={`pointer-events-auto relative bg-card-bg shadow-modal border-l border-border/60 w-full h-full flex flex-col overflow-hidden ${closing ? "" : "motion-safe:animate-slide-in-right"}`}
        style={
          closing
            ? {
                transform: "translateX(100%)",
                transition: "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : undefined
        }
      >

        {/* Delete confirmation overlay */}
        {confirmDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/20 backdrop-blur-[2px] motion-safe:animate-fade-in">
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
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/20 backdrop-blur-[2px] motion-safe:animate-fade-in">
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

        {/* ── Header — delete left, close right ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-1 px-4 py-2 border-b border-border/30">
          <button
            onClick={() => { setTagToDelete(null); setConfirmDelete(true); }}
            className="p-2 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Delete task"
            aria-label="Delete task"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4l-.6 7.4A1 1 0 019.4 12H4.6a1 1 0 01-1-.6L3 4"/>
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-column-bg transition-colors"
            title="Close"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        </div>

        {/* ── Body: single column on mobile, 2-column (main | properties sidebar) on desktop ── */}
        <div className="relative flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        <div className="flex flex-col min-h-0 flex-1 md:min-w-0">
          <div ref={modalBodyRef} className="flex-1 overflow-y-auto antialiased">

            {/* Title */}
            <div className="px-8 md:px-10 pt-10 pb-4">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={commitTitle}
                  className="w-full text-[30px] font-bold text-ink leading-tight bg-column-bg rounded-lg px-2 py-1 outline-none border-none shadow-none ring-0 appearance-none -mx-2"
                />
              ) : (
                <h2
                  onClick={() => { setDraftTitle(optimisticTitle ?? task.title); setIsEditingTitle(true); }}
                  className="text-[30px] font-bold text-ink leading-tight cursor-text rounded-lg px-2 py-1 -mx-2 hover:bg-column-bg transition-colors"
                >
                  {optimisticTitle ?? task.title}
                </h2>
              )}
            </div>

            {/* Quick meta row — desktop only; mobile renders the full properties grid below */}
            {isDesktop && (() => {
              const m = boardMembers.find((bm) => bm.id === assigneeId);
              const hasDeadline = !!deadline && deadlineInfo.severity !== "none";
              const colIdx = columns.findIndex((c) => c.id === columnId);
              const colLabel = columns.find((c) => c.id === columnId)?.label;
              const itemClass = "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-column-bg transition-colors cursor-pointer";
              return (
                <div className="px-8 md:px-10 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted mr-1">Properties</span>

                  {/* Phase */}
                  {colLabel && (
                    <div ref={metaPhaseRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMetaProp((cur) => cur === "phase" ? null : "phase")}
                        className={`${itemClass} text-ink`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(colIdx)}`} />
                        <span>{colLabel}</span>
                      </button>
                      {openMetaProp === "phase" && (
                        <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                          {columns.map((c) => {
                            const isSelected = c.id === columnId;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  userHasEdited.current = true;
                                  setColumnId(c.id);
                                  setOpenMetaProp(null);
                                  void handleUpdateWithFeedback(task.id, { column: c.id } as Partial<Task>);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"}`}
                              >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(columns.indexOf(c))}`} />
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
                  )}

                  {/* Priority */}
                  <div ref={metaPriorityRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMetaProp((cur) => cur === "priority" ? null : "priority")}
                      className={`${itemClass} text-ink`}
                    >
                      <PriorityIcon priority={priority} className="w-3.5 h-3.5" />
                      <span className="capitalize text-white">{priority}</span>
                    </button>
                    {openMetaProp === "priority" && (
                      <div className="absolute top-full left-0 mt-1 z-50 w-48 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                        {(["low", "medium", "high", "urgent"] as const).map((p) => {
                          const isSelected = priority === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setPriority(p);
                                setOpenMetaProp(null);
                                void handleUpdateWithFeedback(task.id, { priority: p });
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"}`}
                            >
                              <PriorityIcon priority={p} className="w-3.5 h-3.5" />
                              <span className="capitalize">{p}</span>
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

                  {/* Assignee */}
                  {m && (
                    <div ref={metaAssigneeRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMetaProp((cur) => cur === "assignee" ? null : "assignee")}
                        className={`${itemClass} text-ink`}
                      >
                        <span
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        <span>{m.handle ? `@${m.handle}` : m.name}</span>
                      </button>
                      {openMetaProp === "assignee" && (
                        <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                          {[{ id: "", name: "Unassigned", color: "", handle: undefined as string | null | undefined }, ...boardMembers].map((bm) => {
                            const isSelected = bm.id === assigneeId;
                            return (
                              <button
                                key={bm.id}
                                type="button"
                                onClick={() => {
                                  userHasEdited.current = true;
                                  setAssigneeId(bm.id);
                                  setOpenMetaProp(null);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                  isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
                                }`}
                              >
                                {bm.id === "" ? (
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-border flex items-center justify-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />
                                  </span>
                                ) : (
                                  <span
                                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                    style={{ backgroundColor: bm.color }}
                                  >
                                    {bm.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate">{bm.id === "" ? bm.name : (bm.handle ? `@${bm.handle}` : bm.name)}</span>
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
                  )}

                  {/* Deadline — clicking the pill opens the native date picker */}
                  {hasDeadline && (
                    <button
                      type="button"
                      onClick={() => { try { metaDeadlineInputRef.current?.showPicker?.(); } catch {} }}
                      className={`${itemClass} ${
                        deadlineInfo.severity === "overdue"  ? "text-red-600 dark:text-red-400" :
                        deadlineInfo.severity === "due-soon" ? "text-orange-500 dark:text-orange-400" :
                                                              "text-ink"
                      }`}
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="10" height="9" rx="1.5"/>
                        <path d="M5 1.5v3M9 1.5v3M2 7h10"/>
                      </svg>
                      <span>{deadlineInfo.label}</span>
                      <input
                        ref={metaDeadlineInputRef}
                        type="date"
                        value={deadline}
                        onChange={(e) => { userHasEdited.current = true; setDeadline(e.target.value); }}
                        className="sr-only"
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Tags row — desktop only */}
            {isDesktop && (() => {
              const selectedIds = optimisticTagIds ?? task.tags?.map((t) => t.id) ?? [];
              const selectedTags = allBoardTags.filter((t) => selectedIds.includes(t.id));
              return (
                <div className="px-8 md:px-10 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted mr-1">Tags</span>
                  <div ref={metaTagDropdownRef} className="relative flex flex-wrap items-center gap-1.5">
                    {selectedTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium leading-none text-ink border border-border/60 hover:bg-column-bg transition-colors"
                        title="Click to remove"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span>{tag.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => { setTagDropdownOpen(false); setMetaTagDropdownOpen((v) => !v); }}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-column-bg transition-colors"
                      title="Manage tags"
                      aria-label="Add tag"
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 3v8M3 7h8" />
                      </svg>
                    </button>

                    {metaTagDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                        {!isCreatingTag && (
                          <div className="pb-1 max-h-56 overflow-y-auto no-scrollbar">
                            {allBoardTags.length === 0 ? (
                              <p className="px-4 py-4 text-center text-xs text-muted">No tags found.</p>
                            ) : (
                              allBoardTags.map((tag) => {
                                const isSelected = selectedIds.some((id) => id === tag.id);
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
                </div>
              );
            })()}

            {/* Properties (mobile only — desktop renders these in the right column) */}
            {!isDesktop && (
            <div className="px-8 pb-6 border-b border-border/30">
              <div className="grid grid-cols-[110px_1fr] gap-x-5 gap-y-4 items-center text-sm">
                {renderPropertiesRows("mobile")}
              </div>
            </div>
            )}

            {/* Description — full width, max-width inner column for comfortable reading */}
            <div className="px-8 md:px-10 pt-8 md:pt-4 pb-8 border-b border-border/30">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">
                Description
              </label>
              <div className="max-w-[720px]">
                {isEditingDescription ? (
                  <textarea
                    ref={descriptionTextareaRef}
                    value={description}
                    onChange={(e) => { userHasEdited.current = true; setDescription(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        // Revert description only — do NOT clear userHasEdited globally:
                        // other fields (deadline, assignee) may have unsaved edits that
                        // would be silently dropped by the debounced-save guards.
                        setDescription(descriptionOriginalRef.current);
                        setIsEditingDescription(false);
                      }
                    }}
                    onBlur={() => {
                      setIsEditingDescription(false);
                      void flushUpdates();
                    }}
                    placeholder="Write a detailed description..."
                    className="w-full min-h-[6rem] bg-column-bg/40 rounded-lg px-3 py-2.5 text-[15px] leading-[1.7] text-ink ring-1 ring-transparent focus:ring-border/60 focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    onClick={() => {
                      descriptionOriginalRef.current = description;
                      setIsEditingDescription(true);
                    }}
                    className="min-h-[6rem] px-3 py-2.5 rounded-lg bg-column-bg/40 cursor-text hover:bg-column-bg transition-colors text-ink"
                  >
                    {description ? (
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.7]" style={{ whiteSpace: "pre-wrap" }}>
                        {description}
                      </div>
                    ) : (
                      <span className="text-muted text-[15px]">Write a detailed description...</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div ref={commentsRef} className="px-8 md:px-10 py-8 border-b border-border/30">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-4">
                Comments{comments.length > 0 && <span className="normal-case font-normal ml-1">({comments.length})</span>}
              </label>
              {commentsLoading ? (
                <div className="space-y-5">
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-1 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-column-bg/40" />
                        <div className="h-3 w-24 bg-column-bg/40 rounded" />
                        <div className="h-3 w-12 bg-column-bg/40 rounded ml-auto" />
                      </div>
                      <div className="h-4 bg-column-bg/40 rounded w-full ml-8" />
                    </div>
                  ))}
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-5">
                  {comments.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: nameToColor(c.author || "A") }}
                        >
                          {(c.author || "A").charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          {c.author || <span className="italic font-normal text-muted">Anonymous</span>}
                        </span>
                        <span className="text-xs text-muted">{formatTimeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-[15px] text-ink/85 leading-relaxed pl-8">{c.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted italic">No comments yet.</p>
              )}
            </div>

            {/* Info, Activity, History (mobile only — desktop renders these in the right column) */}
            {!isDesktop && (
            <div className="px-8 py-6 space-y-6">
              {renderMetaPanels("mobile")}
            </div>
            )}
          </div>

          {/* Comment input — pinned to bottom of left column */}
          <div className="flex-shrink-0 px-8 md:px-10 py-3 border-t border-border/30 bg-card-bg">
            <div className="flex gap-2 bg-column-bg/60 rounded-xl p-2 ring-1 ring-border/40 focus-within:ring-accent/30 transition-all">
              <input
                ref={commentInputRef}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={handleCommentKey}
                placeholder="Write a comment..."
                className="flex-1 bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-muted border-none outline-none"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-ink text-paper text-xs font-bold hover:opacity-90 disabled:opacity-20 transition-all flex-shrink-0 shadow-sm"
              >
                Post
              </button>
            </div>
          </div>
        </div>{/* /left column */}

        {/* ── Right column: properties sidebar (desktop only) ── */}
        {isDesktop && (
          <>
            <div className="w-px bg-border/30 flex-shrink-0" />
            <aside className="flex flex-col w-[36%] max-w-[440px] min-w-[320px] flex-shrink-0 min-h-0 bg-panel-bg">
              <div className="flex-1 overflow-y-auto antialiased px-6 py-7 space-y-7">

                {/* Properties (desktop) */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Properties</p>
                  <div className="bg-column-bg/40 rounded-xl border border-border/30 px-4 py-4">
                    <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-4 items-center text-sm">
                      {renderPropertiesRows("desktop")}
                    </div>
                  </div>
                </div>

                {/* Info, Activity, History (desktop) */}
                <div className="space-y-6">
                  {renderMetaPanels("desktop")}
                </div>

              </div>
            </aside>
          </>
        )}

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

