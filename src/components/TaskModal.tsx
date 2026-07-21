"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { Task, Comment, TaskActivity, Attachment } from "@/lib/types";
import dynamic from "next/dynamic";
const DiffViewer = dynamic(() => import("./DiffViewer"), { ssr: false, loading: () => null });
import {
  isOverdue,
  timeInColumn,
  formatDateForInput,
  dateInputToISOString,
  formatDateTime,
  formatTimeAgo,
  formatDeadlineLabel,
} from "@/lib/utils";
import useBoardResources from "@/hooks/useBoardResources";
import { LABEL_PALETTE } from "@/lib/labelPalette";
import PriorityIcon from "./PriorityIcon";
import MarkdownText from "./MarkdownText";
import MarkdownToolbar from "./MarkdownToolbar";
import { resolveColumnPalette } from "@/lib/columnPalette";
import { nameToColor } from "@/lib/avatarColor";
import Avatar from "./Avatar";
import { useToasts } from "@/components/Toasts";
import { DropdownMenu, DropdownItem, DropdownDivider } from "./ui/DropdownMenu";

const getColumnDot = (color: string | null | undefined, index: number) =>
  index < 0 ? "bg-muted" : resolveColumnPalette(color, index).dot;

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  task: Task | null;
  boardMembers?: import("@/lib/types").BoardMemberData[];
  columns?: import("@/lib/types").ColumnData[];
  onClose: () => void;
  // Resolves true on success, false on failure. onUpdate handles its own
  // failure UI (revert + toast) internally and does not throw, so callers
  // that need to know whether the write actually landed must check this.
  onUpdate: (id: string, data: Partial<Task>) => Promise<boolean>;
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
  const toasts = useToasts();
  const [, setTick] = useState(0);
  const [description, setDescription] = useState("");
  const [optimisticTitle, setOptimisticTitle] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Multi-assignee: ordered set of user ids. Joined-string debounce keeps
  // comparisons stable across renders.
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const assigneeDropdownRef = useRef<HTMLButtonElement>(null);
  const [columnId, setColumnId] = useState("");
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLButtonElement>(null);
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
  const tagDropdownRef = useRef<HTMLButtonElement>(null);
  const [metaTagDropdownOpen, setMetaTagDropdownOpen] = useState(false);
  const metaTagDropdownRef = useRef<HTMLButtonElement>(null);
  const [openMetaProp, setOpenMetaProp] = useState<null | "phase" | "priority" | "assignee">(null);
  const metaPhaseRef = useRef<HTMLButtonElement>(null);
  const metaPriorityRef = useRef<HTMLButtonElement>(null);
  const metaAssigneeRef = useRef<HTMLButtonElement>(null);
  const metaDeadlineInputRef = useRef<HTMLInputElement>(null);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const priorityDropdownRef = useRef<HTMLButtonElement>(null);
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
  const [tagCreatePhase, setTagCreatePhase] = useState<"name" | "color" | null>(null);
  

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveErrorTimeoutRef = useRef<number | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const pendingRequestsRef = useRef<{ comments?: Promise<any> | null; activities?: Promise<any> | null; versions?: Promise<any> | null }>({ comments: null, activities: null, versions: null });
  const activityIdleTimerRef = useRef<number | null>(null);
  const descriptionOriginalRef = useRef<string>("");
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const debouncedDescription = useDebounce(description, 600);
  const debouncedAssigneeIds = useDebounce(assigneeIds.join(","), 600);
  const debouncedDeadline = useDebounce(deadline, 600);
  const [optimisticTagIds, setOptimisticTagIds] = useState<string[] | null>(null);

  const prevTask = useRef<string | null>(null);
  const originalTask = useRef<{ description?: string; assigneeIds?: string; deadline?: string | null } | null>(null);
  const descriptionLastRecordedRef = useRef<string>("");
  const historyStaleRef = useRef(false);
  const skipNextBlurFlushRef = useRef(false);
  const wasClosedRef = useRef(false);
  const flushUpdatesRef = useRef<(() => void) | null>(null);
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
    if (!task) {
      // Modal closed while the component stays mounted (task prop cleared).
      // Force a full re-sync on reopen even if it's the same task id — the
      // server content may have changed while it was closed.
      wasClosedRef.current = true;
      return;
    }

    // Only sync everything when switching to a new task id (or reopening
    // after being closed) - otherwise do a minimal, non-destructive sync
    const idChanged = task.id !== prevTask.current;
    if (idChanged || wasClosedRef.current) {
      wasClosedRef.current = false;
      prevTask.current = task.id;
      userHasEdited.current = false;
      previousFocusRef.current = document.activeElement as HTMLElement;
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
      setVersions([]);
      historyStaleRef.current = false;
      const taskAssigneeIds = task.assignees?.length
        ? task.assignees.map((a) => a.id)
        : task.assigneeId
        ? [task.assigneeId]
        : [];
      setAssigneeIds(taskAssigneeIds);
      setColumnId(task.column ?? "");
      const initialDeadlineDate = formatDateForInput(task.deadline);
      setDeadline(initialDeadlineDate);

      originalTask.current = {
        description: task.description ?? "",
        assigneeIds: taskAssigneeIds.join(","),
        deadline: dateInputToISOString(initialDeadlineDate),
      };
      // Only reset the history baseline for a genuinely new task. Reopening
      // the same task after a close must not clobber a pending retry (e.g. a
      // recordHistory write that failed earlier this session) - the server
      // dedupes redundant recordHistory sends against the latest version row,
      // so leaving this stale is safe; resetting it would silently drop the
      // pending write.
      if (idChanged) {
        descriptionLastRecordedRef.current = task.description ?? "";
      }

      // sync comments/activities/attachments on first load for this task
      setComments(task.comments ?? []);
      setActivities(task.activities ?? []);
      setAttachments(task.attachments ?? []);

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
      const hasPendingOptimistic = comments.some((c) => c.id.startsWith("local-"));
      if ((!comments || comments.length === 0) && incomingComments.length > 0) {
        setComments(incomingComments);
      } else if (lastIncomingCommentId && lastIncomingCommentId !== lastLocalCommentId && !hasPendingOptimistic) {
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

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    e.target.value = "";
    setUploading(true);
    for (const file of files) {
      setUploadError(null);
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" is too large. Files must be under 10 MB.`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: "POST", body: fd });
        if (res.ok) {
          const attachment: Attachment = await res.json();
          setAttachments((prev) => [...prev, attachment]);
        } else {
          const data = await res.json().catch(() => ({}));
          const msg = data.error ?? "Upload failed.";
          if (msg.includes("storage full") || msg.includes("storage limit") || msg.includes("too large")) {
            setUploadError(msg);
          } else {
            toasts.push({ title: msg });
          }
        }
      } catch {
        toasts.push({ title: "Upload failed." });
      }
    }
    setUploading(false);
  }, [task, toasts]);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    let removed: Attachment | undefined;
    setAttachments((prev) => {
      removed = prev.find((a) => a.id === attachmentId);
      return prev.filter((a) => a.id !== attachmentId);
    });
    const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    if (!res.ok) {
      toasts.push({ title: "Could not delete attachment." });
      if (removed) setAttachments((prev) => [...prev, removed!].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
    }
  }, [toasts]);

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

  const TITLE_CHAR_LIMIT = 200;

  // commit title optimistically (non-blocking)
  const commitTitle = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (!trimmed || !task) {
      setDraftTitle(task?.title ?? "");
      setIsEditingTitle(false);
      return;
    }
    if (trimmed.length > TITLE_CHAR_LIMIT) return;
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
      // Flush any pending description/assignee/deadline edits before tearing
      // down — board switches and navigation don't go through handleClose,
      // so without this a pending edit (and its history entry) is silently
      // lost. Must run before isMounted flips false since flushUpdates gates
      // on it.
      flushUpdatesRef.current?.();
      isMounted.current = false;
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    };
  }, []);

  // Flush pending edits when the tab/app goes to the background. Covers tab
  // switches, app backgrounding, and (in most browsers) tab close — cases the
  // unmount cleanup above doesn't reach because the component stays mounted.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushUpdatesRef.current?.();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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

  // Re-render every 30s so relative timestamps stay current
  useEffect(() => {
    if (!task) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [task]);

  // Tags are provided from shared `useBoardResources` hook to avoid duplicate fetches.

  // Wrapper for onUpdate to show saving feedback
  const handleUpdateWithFeedback = useCallback(async (id: string, data: Partial<Task>) => {
    if (!task) return;
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    setSaving(true);
    setSaveError(false);
    if (saveErrorTimeoutRef.current) window.clearTimeout(saveErrorTimeoutRef.current);
    try {
      // onUpdate (Board.tsx's handleUpdateTask) handles its own failure UI
      // internally (revert optimistic state + toast) and resolves false
      // rather than throwing, so it must be checked explicitly here — a
      // try/catch alone would never observe the failure.
      const success = await onUpdate(id, data);
      if (!isMounted.current) return;
      if (!success) {
        setSaveError(true);
        saveErrorTimeoutRef.current = window.setTimeout(() => setSaveError(false), 5000);
        return;
      }
      // Refresh the saved baseline for the fields we just persisted so later
      // autosaves and the flush-on-close don't re-send unchanged values
      // (redundant writes, and for description a redundant "Updated the
      // description" activity).
      if (originalTask.current) {
        const d = data as any;
        if ("description" in d) originalTask.current.description = d.description ?? "";
        if ("deadline" in d) originalTask.current.deadline = d.deadline ? dateInputToISOString(formatDateForInput(d.deadline)) : null;
        if ("assigneeIds" in d) originalTask.current.assigneeIds = (d.assigneeIds ?? []).join(",");
      }
      // Only advance the history baseline once the recordHistory request has
      // actually succeeded. Advancing it eagerly (before the request fires)
      // meant a failed save silently dropped the history entry for good,
      // since the next flush would see no diff and never retry it.
      const d2 = data as any;
      if (d2.recordHistory === true && "description" in d2) {
        descriptionLastRecordedRef.current = d2.description ?? "";
        historyStaleRef.current = true;
      }
    } catch (err) {
      // Safety net for an unexpected throw (onUpdate is not expected to
      // throw in normal operation - see above). Board.tsx has not shown a
      // toast in this path, so it's still correct to show one here.
      console.error("Update failed", err);
      if (!isMounted.current) return;
      setSaveError(true);
      saveErrorTimeoutRef.current = window.setTimeout(() => setSaveError(false), 5000);
      toasts.push({ title: "Could not save changes", description: "Please try again." });
    } finally {
      if (!isMounted.current) return;
      savingTimeoutRef.current = setTimeout(() => setSaving(false), 400);
    }
  }, [onUpdate, task, toasts]);

  useEffect(() => {
    if (!task || !isMounted.current || prevTask.current !== task.id) return;
    if (!userHasEdited.current) return;
    if (debouncedAssigneeIds !== (originalTask.current?.assigneeIds ?? "")) {
      void handleUpdateWithFeedback(task.id, {
        assigneeIds: debouncedAssigneeIds === "" ? [] : debouncedAssigneeIds.split(","),
      } as unknown as Partial<Task>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAssigneeIds]);

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
    const deadlineValue = dateInputToISOString(debouncedDeadline);
    const originalDeadline = originalTask.current?.deadline ?? null;
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
    if (assigneeIds.join(",") !== (originalTask.current?.assigneeIds ?? "")) {
      (updates as any).assigneeIds = assigneeIds;
    }
    const deadlineValue = dateInputToISOString(deadline);
    const originalDeadline = originalTask.current?.deadline ?? null;
    if (deadlineValue !== originalDeadline) {
      updates.deadline = deadlineValue;
    }

    // Record a description history entry when the user finishes editing
    // (blur or close). The debounced auto-save skips history; this is the
    // one place that requests it. descriptionLastRecordedRef only advances
    // once the request actually succeeds (see handleUpdateWithFeedback), so
    // a failed save is retried on the next flush instead of being lost.
    if (description !== descriptionLastRecordedRef.current) {
      if (!("description" in updates)) {
        // Content already auto-saved; send it again so the server has the
        // value for the history entry (same content, negligible extra write).
        updates.description = description;
      }
      (updates as any).recordHistory = true;
    }

    // Send all pending updates in background (do not block UI/closing)
    if (Object.keys(updates).length > 0) {
      void handleUpdateWithFeedback(task.id, updates);
    }
  }, [task, description, assigneeIds, deadline, handleUpdateWithFeedback]);

  useEffect(() => {
    flushUpdatesRef.current = flushUpdates;
  }, [flushUpdates]);

  const handleClose = useCallback(() => {
    setConfirmDelete(false);
    setTagToDelete(null);
    // Close all dropdowns so they don't visibly slide out with the panel
    setAssigneeDropdownOpen(false);
    setColumnDropdownOpen(false);
    setPriorityDropdownOpen(false);
    setTagDropdownOpen(false);
    setMetaTagDropdownOpen(false);
    setOpenMetaProp(null);
    // flush in background so closing feels instant
    flushUpdates();
    setClosing(true);
    // Let the slide-out animation play before unmounting via parent
    setTimeout(() => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      onClose();
    }, 200);
  }, [flushUpdates, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation(); // prevent ClassWorkspace / BoardContainer window listeners from also firing
    if (!isEditingTitleRef.current && !isEditingDescriptionRef.current) handleClose();
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
  }, [task?.id]);

  const handleAddComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !task) return;
    // optimistic UI: add a local comment and activity immediately
    setCommentInput("");
    const localId = `local-comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const localActId = `local-act-comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
      // Remove the optimistic activity — board polling never carries activities, so it
      // would stay stuck forever. Drop it and fetch the real server entry instead.
      setActivities((prev) => prev.filter((a) => a.id !== localActId));
      void fetchActivitiesForTask(task.id);
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
  // derive semantic deadline info from the local date/time inputs (shows unsaved edits)
  const deadlineInfo = formatDeadlineLabel(dateInputToISOString(deadline), task.completedAt);

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
        {/* Assignees — multi-select; clicking a member toggles them */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="5" r="2.5"/>
            <path d="M2 13a5 5 0 0110 0"/>
          </svg>
          {assigneeIds.length > 1 ? "Assignees" : "Assignee"}
        </div>
        <div className="relative">
          <button
            type="button"
            ref={assigneeDropdownRef}
            onClick={() => setAssigneeDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={assigneeDropdownOpen}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
          >
            {(() => {
              const selected = assigneeIds
                .map((id) => boardMembers.find((bm) => bm.id === id))
                .filter((m): m is NonNullable<typeof m> => !!m);
              if (selected.length === 0) return <span className="text-muted">Unassigned</span>;
              return (
                <>
                  <span className="flex items-center flex-shrink-0">
                    {selected.slice(0, 3).map((m, i) => (
                      <Avatar key={m.id} name={m.name} color={m.color} size="sm" className={`ring-1 ring-card-bg ${i > 0 ? "-ml-1.5" : ""}`} />
                    ))}
                  </span>
                  <span className="truncate">
                    {selected.length === 1
                      ? selected[0].name
                      : `${selected[0].name} +${selected.length - 1}`}
                  </span>
                </>
              );
            })()}
          </button>
          <DropdownMenu open={assigneeDropdownOpen} onClose={() => setAssigneeDropdownOpen(false)} anchorRef={assigneeDropdownRef} className="w-64">
            <DropdownItem
              checked={assigneeIds.length === 0}
              icon={<Avatar size="sm" />}
              onClick={() => {
                userHasEdited.current = true;
                setAssigneeIds([]);
                setAssigneeDropdownOpen(false);
              }}
            >
              Unassigned
            </DropdownItem>
            {boardMembers.filter((m) => m.classRole !== "educator" && m.classRole !== "ta").map((m) => (
              <DropdownItem
                key={m.id}
                checked={assigneeIds.includes(m.id)}
                icon={<Avatar name={m.name} color={m.color} size="sm" />}
                onClick={() => {
                  userHasEdited.current = true;
                  setAssigneeIds((prev) =>
                    prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                  );
                }}
              >
                {m.name}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </div>

        {/* Phase */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 9l5-3 5 3M2 5l5-3 5 3"/>
          </svg>
          Phase
        </div>
        <div className="relative">
          <button
            type="button"
            ref={columnDropdownRef}
            onClick={() => setColumnDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={columnDropdownOpen}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(columns.find((c) => c.id === columnId)?.color, columns.findIndex((c) => c.id === columnId))}`} />
            <span className="truncate">{columns.find((c) => c.id === columnId)?.label ?? "Unknown"}</span>
          </button>
          <DropdownMenu open={columnDropdownOpen} onClose={() => setColumnDropdownOpen(false)} anchorRef={columnDropdownRef} className="w-64">
            {columns.map((c) => (
              <DropdownItem
                key={c.id}
                selected={c.id === columnId}
                icon={<span className={`inline-block w-[7px] h-[7px] rounded-full flex-shrink-0 ${getColumnDot(c.color, columns.indexOf(c))}`} />}
                onClick={() => {
                  userHasEdited.current = true;
                  setColumnId(c.id);
                  setColumnDropdownOpen(false);
                  void handleUpdateWithFeedback(task.id, { column: c.id } as Partial<Task>);
                }}
              >
                {c.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 12V9M6 12V6M10 12V3"/>
          </svg>
          Priority
        </div>
        <div className="relative">
          <button
            type="button"
            ref={priorityDropdownRef}
            onClick={() => setPriorityDropdownOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={priorityDropdownOpen}
            className="-mx-2 px-2 py-1 rounded-md text-sm text-ink hover:bg-column-bg transition-colors text-left flex items-center gap-2 w-full max-w-full"
          >
            <PriorityIcon priority={priority} className="w-3.5 h-3.5" />
            <span className={priorityLabelClass}>{priority}</span>
          </button>
          <DropdownMenu open={priorityDropdownOpen} onClose={() => setPriorityDropdownOpen(false)} anchorRef={priorityDropdownRef} className="w-48">
            {(["low", "medium", "high", "urgent"] as const).map((p) => (
              <DropdownItem
                key={p}
                selected={priority === p}
                icon={<PriorityIcon priority={p} className="w-3.5 h-3.5" />}
                onClick={() => {
                  setPriority(p);
                  setPriorityDropdownOpen(false);
                  void handleUpdateWithFeedback(task.id, { priority: p });
                }}
              >
                <span className="capitalize">{p}</span>
              </DropdownItem>
            ))}
          </DropdownMenu>
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
          <div className="inline-flex items-center gap-0">
            <input
              type="date"
              value={deadline}
              onChange={(e) => {
                userHasEdited.current = true;
                setDeadline(e.target.value);
              }}
              className="-mx-2 px-2 py-1 bg-transparent text-sm text-ink rounded-md hover:bg-column-bg focus:bg-column-bg focus:outline-none transition-colors"
            />
            {deadline && (
              <button
                type="button"
                onClick={() => {
                  userHasEdited.current = true;
                  setDeadline("");
                  // Fire immediately so removal never depends on the debounce/close flush.
                  void handleUpdateWithFeedback(task.id, { deadline: null } as Partial<Task>);
                }}
                title="Remove deadline"
                aria-label="Remove deadline"
                className="w-4 h-4 rounded-full flex items-center justify-center bg-muted/20 hover:bg-muted/40 text-muted hover:text-ink transition-colors flex-shrink-0 self-center ml-1"
              >
                <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: "translate(0px, 0.5px)" }}>
                  <path d="M1 1l5 5M6 1L1 6" />
                </svg>
              </button>
            )}
          </div>
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
        <div className="relative">
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
              ref={tagDropdownRef}
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              aria-haspopup="menu"
              aria-expanded={tagDropdownOpen}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-column-bg transition-colors"
              title="Manage tags"
              aria-label="Add tag"
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 3v8M3 7h8"/>
              </svg>
            </button>
          </div>

          <DropdownMenu
            open={tagDropdownOpen}
            onClose={() => { setTagDropdownOpen(false); setIsCreatingTag(false); setTagCreatePhase(null); }}
            anchorRef={tagDropdownRef}
            className="w-56"
          >
            {!isCreatingTag && (
              <div className="max-h-56 overflow-y-auto no-scrollbar">
                {allBoardTags.length === 0 ? (
                  <p className="px-2.5 py-4 text-center text-xs text-muted">No tags found.</p>
                ) : (
                  allBoardTags.map((tag) => {
                    const isSelected = (optimisticTagIds ?? task.tags?.map((t) => t.id) ?? []).some((id) => id === tag.id);
                    return (
                      <div
                        key={tag.id}
                        onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                          isSelected ? "bg-ink/5 text-ink font-medium" : "text-ink/80 hover:text-ink hover:bg-ink/5"
                        }`}
                      >
                        <span className="w-[9px] h-[9px] flex-shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
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
              <div className="p-1">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name…"
                  className="w-full bg-column-bg border border-border rounded-md px-3 py-1.5 text-sm text-ink outline-none"
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
                <div className="mt-3 flex items-center justify-between px-1">
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
              <div className="max-h-56 overflow-y-auto no-scrollbar">
                {LABEL_PALETTE.map((p) => (
                  <DropdownItem
                    key={p.id}
                    icon={<span className="inline-block w-[9px] h-[9px] rounded-full" style={{ backgroundColor: p.hex }} />}
                    onClick={() => handleCreateTagWithColor(p.hex)}
                  >
                    {p.name}
                  </DropdownItem>
                ))}
              </div>
            )}

            {!isCreatingTag && (
              <>
                <DropdownDivider />
                <DropdownItem onClick={() => { setIsCreatingTag(true); setTagCreatePhase("name"); }}>
                  <span className="flex items-center justify-center gap-1 w-full">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 3v8M3 7h8" />
                    </svg>
                    Create new tag
                  </span>
                </DropdownItem>
              </>
            )}
          </DropdownMenu>
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
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink transition-colors w-full text-left"
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
                    <Avatar name={a.user?.name} color={a.user?.color} size="sm" className="mt-0.5" />
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

        {/* Description History */}
        <div>
          <button
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              if (next && (versions.length === 0 || historyStaleRef.current)) {
                historyStaleRef.current = false;
                void fetchVersionsDeduped();
              }
            }}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink transition-colors w-full text-left"
          >
            <svg
              className={`transition-transform duration-150 ${showHistory ? "rotate-90" : ""}`}
              width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
            >
              <path d="M3 2l4 3-4 3"/>
            </svg>
            {showHistory ? "Hide description history" : "Show description history"}
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
                          <Avatar name={v.user.name} color={v.user.color} size="xs" />
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
        aria-modal="true"
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

        {/* ── Header — Back to board (Esc); delete lives at the bottom of the modal ── */}
        <div className="flex-shrink-0 flex items-center justify-start gap-1 px-4 py-2 border-b border-border/30">
          <div className="relative group/close">
            <button
              onClick={handleClose}
              className="flex items-center px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-column-bg transition-colors"
              aria-label="Back"
            >
              Back
            </button>
            {/* Hover tooltip surfacing the Esc shortcut */}
            <div className="pointer-events-none absolute top-full left-0 mt-2 z-50 opacity-0 group-hover/close:opacity-100 transition-opacity duration-150">
              <div className="flex items-center gap-1.5 bg-ink border border-paper/10 rounded-lg px-2.5 py-2 shadow-lg whitespace-nowrap">
                <span className="text-xs text-paper/90">Return To Board</span>
                <kbd className="font-sans rounded-md border border-paper/20 bg-paper/10 px-1.5 py-0.5 text-[10px] font-semibold text-paper leading-none">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body: single column on mobile, 2-column (main | properties sidebar) on desktop ── */}
        <div className="relative flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        <div className="flex flex-col min-h-0 flex-1 md:min-w-0">
          <div ref={modalBodyRef} className="flex-1 overflow-y-auto antialiased">

            {/* Title */}
            <div className="px-8 md:px-10 pt-10 pb-4">
              {isEditingTitle ? (
                <>
                <input
                  ref={titleInputRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={commitTitle}
                  className="w-full text-[30px] font-bold text-ink leading-tight bg-column-bg rounded-lg px-2 py-1 outline-none border-none shadow-none ring-0 appearance-none -mx-2"
                />
                {draftTitle.length > 0 && (
                  <p className={`text-xs mt-1 px-1 ${draftTitle.length > TITLE_CHAR_LIMIT ? "text-red-400" : "text-muted"}`}>
                    {draftTitle.length > TITLE_CHAR_LIMIT ? `${draftTitle.length}/${TITLE_CHAR_LIMIT} characters, too long` : `${draftTitle.length}/${TITLE_CHAR_LIMIT}`}
                  </p>
                )}
                </>
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
              const metaAssignees = assigneeIds
                .map((id) => boardMembers.find((bm) => bm.id === id))
                .filter((mm): mm is NonNullable<typeof mm> => !!mm);
              const hasDeadline = !!deadline && deadlineInfo.severity !== "none";
              const colIdx = columns.findIndex((c) => c.id === columnId);
              const colColor = columns.find((c) => c.id === columnId)?.color;
              const colLabel = columns.find((c) => c.id === columnId)?.label;
              const itemClass = "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-column-bg transition-colors cursor-pointer";
              return (
                <div className="px-8 md:px-10 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted mr-1">Properties</span>

                  {/* Phase */}
                  {colLabel && (
                    <div className="relative">
                      <button
                        type="button"
                        ref={metaPhaseRef}
                        onClick={() => setOpenMetaProp((cur) => cur === "phase" ? null : "phase")}
                        aria-haspopup="menu"
                        aria-expanded={openMetaProp === "phase"}
                        className={`${itemClass} text-ink`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnDot(colColor, colIdx)}`} />
                        <span>{colLabel}</span>
                      </button>
                      <DropdownMenu open={openMetaProp === "phase"} onClose={() => setOpenMetaProp(null)} anchorRef={metaPhaseRef} className="w-56">
                        {columns.map((c) => (
                          <DropdownItem
                            key={c.id}
                            selected={c.id === columnId}
                            icon={<span className={`inline-block w-[7px] h-[7px] rounded-full flex-shrink-0 ${getColumnDot(c.color, columns.indexOf(c))}`} />}
                            onClick={() => {
                              userHasEdited.current = true;
                              setColumnId(c.id);
                              setOpenMetaProp(null);
                              void handleUpdateWithFeedback(task.id, { column: c.id } as Partial<Task>);
                            }}
                          >
                            {c.label}
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </div>
                  )}

                  {/* Priority */}
                  <div className="relative">
                    <button
                      type="button"
                      ref={metaPriorityRef}
                      onClick={() => setOpenMetaProp((cur) => cur === "priority" ? null : "priority")}
                      aria-haspopup="menu"
                      aria-expanded={openMetaProp === "priority"}
                      className={`${itemClass} text-ink`}
                    >
                      <PriorityIcon priority={priority} className="w-3.5 h-3.5" />
                      <span className="capitalize text-white">{priority}</span>
                    </button>
                    <DropdownMenu open={openMetaProp === "priority"} onClose={() => setOpenMetaProp(null)} anchorRef={metaPriorityRef} className="w-48">
                      {(["low", "medium", "high", "urgent"] as const).map((p) => (
                        <DropdownItem
                          key={p}
                          selected={priority === p}
                          icon={<PriorityIcon priority={p} className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setPriority(p);
                            setOpenMetaProp(null);
                            void handleUpdateWithFeedback(task.id, { priority: p });
                          }}
                        >
                          <span className="capitalize">{p}</span>
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </div>

                  {/* Assignees — multi-select; clicking a member toggles them */}
                  {metaAssignees.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        ref={metaAssigneeRef}
                        onClick={() => setOpenMetaProp((cur) => cur === "assignee" ? null : "assignee")}
                        aria-haspopup="menu"
                        aria-expanded={openMetaProp === "assignee"}
                        className={`${itemClass} text-ink`}
                      >
                        <span className="flex items-center flex-shrink-0">
                          {metaAssignees.slice(0, 3).map((mm, i) => (
                            <Avatar key={mm.id} name={mm.name} color={mm.color} size="sm" className={`ring-1 ring-card-bg ${i > 0 ? "-ml-1.5" : ""}`} />
                          ))}
                        </span>
                        <span>
                          {metaAssignees.length === 1
                            ? metaAssignees[0].name
                            : `${metaAssignees[0].name} +${metaAssignees.length - 1}`}
                        </span>
                      </button>
                      <DropdownMenu open={openMetaProp === "assignee"} onClose={() => setOpenMetaProp(null)} anchorRef={metaAssigneeRef} className="w-64">
                        <DropdownItem
                          checked={assigneeIds.length === 0}
                          icon={<Avatar size="sm" />}
                          onClick={() => {
                            userHasEdited.current = true;
                            setAssigneeIds([]);
                            setOpenMetaProp(null);
                          }}
                        >
                          Unassigned
                        </DropdownItem>
                        {boardMembers.filter((bm) => bm.classRole !== "educator" && bm.classRole !== "ta").map((bm) => (
                          <DropdownItem
                            key={bm.id}
                            checked={assigneeIds.includes(bm.id)}
                            icon={<Avatar name={bm.name} color={bm.color} size="sm" />}
                            onClick={() => {
                              userHasEdited.current = true;
                              setAssigneeIds((prev) =>
                                prev.includes(bm.id) ? prev.filter((id) => id !== bm.id) : [...prev, bm.id]
                              );
                            }}
                          >
                            {bm.name}
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
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
                        onChange={(e) => {
                          userHasEdited.current = true;
                          setDeadline(e.target.value);
                        }}
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
                  <div className="relative flex flex-wrap items-center gap-1.5">
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
                      ref={metaTagDropdownRef}
                      onClick={() => { setTagDropdownOpen(false); setMetaTagDropdownOpen((v) => !v); }}
                      aria-haspopup="menu"
                      aria-expanded={metaTagDropdownOpen}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted hover:text-ink hover:bg-column-bg transition-colors"
                      title="Manage tags"
                      aria-label="Add tag"
                    >
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 3v8M3 7h8" />
                      </svg>
                    </button>

                    <DropdownMenu
                      open={metaTagDropdownOpen}
                      onClose={() => { setMetaTagDropdownOpen(false); setIsCreatingTag(false); setTagCreatePhase(null); }}
                      anchorRef={metaTagDropdownRef}
                      className="w-56"
                    >
                      {!isCreatingTag && (
                        <div className="max-h-56 overflow-y-auto no-scrollbar">
                          {allBoardTags.length === 0 ? (
                            <p className="px-2.5 py-4 text-center text-xs text-muted">No tags found.</p>
                          ) : (
                            allBoardTags.map((tag) => {
                              const isSelected = selectedIds.some((id) => id === tag.id);
                              return (
                                <div
                                  key={tag.id}
                                  onClick={(e) => { e.stopPropagation(); toggleTag(tag.id); }}
                                  className={`group flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                                    isSelected ? "bg-ink/5 text-ink font-medium" : "text-ink/80 hover:text-ink hover:bg-ink/5"
                                  }`}
                                >
                                  <span className="w-[9px] h-[9px] flex-shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
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
                        <div className="p-1">
                          <input
                            autoFocus
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="Tag name…"
                            className="w-full bg-column-bg border border-border rounded-md px-3 py-1.5 text-sm text-ink outline-none"
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
                          <div className="mt-3 flex items-center justify-between px-1">
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
                        <div className="max-h-56 overflow-y-auto no-scrollbar">
                          {LABEL_PALETTE.map((p) => (
                            <DropdownItem
                              key={p.id}
                              icon={<span className="inline-block w-[9px] h-[9px] rounded-full" style={{ backgroundColor: p.hex }} />}
                              onClick={() => handleCreateTagWithColor(p.hex)}
                            >
                              {p.name}
                            </DropdownItem>
                          ))}
                        </div>
                      )}

                      {!isCreatingTag && (
                        <>
                          <DropdownDivider />
                          <DropdownItem onClick={() => { setIsCreatingTag(true); setTagCreatePhase("name"); }}>
                            <span className="flex items-center justify-center gap-1 w-full">
                              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 3v8M3 7h8" />
                              </svg>
                              Create new tag
                            </span>
                          </DropdownItem>
                        </>
                      )}
                    </DropdownMenu>
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
                  <div className="relative">
                  <textarea
                    ref={descriptionTextareaRef}
                    value={description}
                    onChange={(e) => { userHasEdited.current = true; setDescription(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        // Revert description only — do NOT clear userHasEdited globally:
                        // other fields (deadline, assignee) may have unsaved edits that
                        // would be silently dropped by the debounced-save guards.
                        // Skip the blur-triggered flush below: unmounting this textarea
                        // fires a native blur whose closure still holds the pre-revert
                        // text (React hasn't re-rendered yet), which would otherwise
                        // persist and history-record the content just discarded. The
                        // next real flush (close, or another field's blur) correctly
                        // picks up the reverted `description` state instead.
                        skipNextBlurFlushRef.current = true;
                        setDescription(descriptionOriginalRef.current);
                        setIsEditingDescription(false);
                      }
                    }}
                    onBlur={() => {
                      setIsEditingDescription(false);
                      if (skipNextBlurFlushRef.current) {
                        skipNextBlurFlushRef.current = false;
                        return;
                      }
                      void flushUpdates();
                    }}
                    placeholder="Write a detailed description..."
                    className="w-full min-h-[6rem] bg-column-bg/40 rounded-lg px-3 py-2.5 text-[15px] leading-[1.7] text-ink ring-1 ring-transparent focus:ring-border/60 focus:outline-none resize-none"
                  />
                  <MarkdownToolbar
                    textareaRef={descriptionTextareaRef}
                    value={description}
                    onChange={(v) => { userHasEdited.current = true; setDescription(v); }}
                  />
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      descriptionOriginalRef.current = description;
                      setIsEditingDescription(true);
                    }}
                    className="min-h-[6rem] px-3 py-2.5 rounded-lg bg-column-bg/40 cursor-text hover:bg-column-bg transition-colors text-ink"
                  >
                    {description ? (
                      <MarkdownText text={description} className="text-[15px] leading-[1.7]" />
                    ) : (
                      <span className="text-muted text-[15px]">Write a detailed description...</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="px-8 md:px-10 py-8 border-b border-border/30">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  Attachments{attachments.length > 0 && <span className="normal-case font-normal ml-1">({attachments.length})</span>}
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-40"
                >
                  {uploading ? "Uploading..." : "+ Attach file"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv"
                />
              </div>
              {uploadError ? (
                <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg className="flex-shrink-0 mt-0.5 text-red-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs text-red-400 leading-snug">{uploadError}</p>
                </div>
              ) : (
                <p className="text-[11px] text-muted/50 mb-3">100 MB per board</p>
              )}
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((a) => {
                    const isImage = a.contentType.startsWith("image/");
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-column-bg/30 hover:bg-column-bg/50 transition-colors group"
                      >
                        {isImage ? (
                          <img
                            src={a.url}
                            alt={a.filename}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-border/40"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-column-bg flex items-center justify-center flex-shrink-0 border border-border/40">
                            <span className="text-[10px] font-bold text-muted uppercase">
                              {a.filename.split(".").pop()?.slice(0, 4) ?? "file"}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-ink hover:underline truncate block leading-tight"
                          >
                            {a.filename}
                          </a>
                          <span className="text-xs text-muted">{formatAttachmentSize(a.size)}</span>
                        </div>
                        <button
                          onClick={() => deleteAttachment(a.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500/15 text-muted hover:text-red-400 transition-all flex-shrink-0"
                          title="Remove attachment"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted italic">No attachments yet.</p>
              )}
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
                  {comments.map((c) => {
                    const commentMember = boardMembers.find(
                      (bm) => (bm.handle && `@${bm.handle}` === c.author) || bm.name === c.author
                    );
                    const displayName = commentMember?.name ?? c.author;
                    return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Avatar name={displayName} color={commentMember?.color} size="md" />
                        <span className="text-sm font-semibold text-ink">
                          {displayName || <span className="italic font-normal text-muted">Anonymous</span>}
                        </span>
                        <span className="text-xs text-muted">{formatTimeAgo(c.createdAt)}</span>
                      </div>
                      <MarkdownText text={c.content} className="text-[15px] text-ink/85 leading-relaxed pl-8" />
                    </div>
                    );
                  })}
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

            {/* Delete task — quiet action at the bottom, away from the Back button */}
            <div className="px-8 md:px-10 py-6 border-t border-border/30">
              <button
                onClick={() => { setTagToDelete(null); setConfirmDelete(true); }}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-red-600 transition-colors"
                aria-label="Delete task"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4l-.6 7.4A1 1 0 019.4 12H4.6a1 1 0 01-1-.6L3 4" />
                </svg>
                Delete task
              </button>
            </div>
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
                className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 disabled:opacity-20 transition-colors flex-shrink-0 shadow-sm"
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
            ) : saveError ? (
              <>
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                <p className="text-xs text-red-500">Could not save, please try again</p>
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

