"use client";

import { useState, useEffect, useCallback } from "react";
import { Task } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import ConfirmModal from "./ConfirmModal";
import { useToasts } from "./Toasts";

type DeletedTask = Task & { deletedAt: string | Date | null; deletedByName?: string | null };

interface Props {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  // Called after a successful restore so the board can re-add the task.
  onRestored: (task: Task) => void;
}

// Lists soft-deleted tasks for a board and restores them. Deleted tasks are
// kept for 30 days, then purged server-side on the next trash open.
export default function TrashPanel({ boardId, isOpen, onClose, onRestored }: Props) {
  const [tasks, setTasks] = useState<DeletedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  // "all" = empty the whole trash; a task id = delete that one forever
  const [confirmTarget, setConfirmTarget] = useState<"all" | DeletedTask | null>(null);
  const { push: pushToast } = useToasts();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/tasks/deleted?boardId=${boardId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Trash load failed: ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error("Failed to load trash:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const restore = async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
      const restored = await res.json();
      setTasks((prev) => prev.filter((t) => t.id !== id));
      onRestored(restored);
    } catch (err) {
      console.error("Failed to restore task:", err);
      pushToast({ title: "Restore failed", description: "Something went wrong. Try again." });
    } finally {
      setRestoringId(null);
    }
  };

  // ConfirmModal always closes after onConfirm settles, success or failure, so
  // a failed purge needs its own visible feedback here -- otherwise the dialog
  // closing reads as confirmation that the delete went through.
  const purge = async (target: "all" | DeletedTask) => {
    const isAll = target === "all";
    if (!isAll) setPurgingId(target.id);
    try {
      const url = isAll
        ? `/api/tasks/deleted?boardId=${boardId}`
        : `/api/tasks/deleted?boardId=${boardId}&taskId=${target.id}`;
      const res = await fetch(url, { method: "DELETE" });
      // A 404 on the single-task path means it's already gone (purged elsewhere,
      // or someone else emptied the trash first) -- treat that as reconciling
      // the list, not a failure.
      if (!res.ok && res.status !== 404) throw new Error(`Permanent delete failed: ${res.status}`);
      setTasks((prev) => (isAll ? [] : prev.filter((t) => t.id !== target.id)));
    } catch (err) {
      console.error("Failed to permanently delete:", err);
      pushToast({ title: isAll ? "Empty trash failed" : "Delete failed", description: "Something went wrong. Try again." });
    } finally {
      if (!isAll) setPurgingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div role="dialog" aria-modal="true" aria-label="Recently deleted tasks" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in" onClick={onClose}>
      <div className="bg-card-bg rounded-2xl shadow-modal w-full max-w-md max-h-[80vh] flex flex-col motion-safe:animate-modal-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-sm font-semibold text-ink">Recently deleted</p>
            <p className="text-xs text-muted mt-0.5">Restorable for 30 days, then permanently removed.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex-shrink-0 text-muted hover:text-ink transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading && <p className="text-sm text-muted py-8 text-center">Loading…</p>}

          {!loading && error && (
            <p className="text-sm text-red-500 py-8 text-center">Could not load deleted tasks. Try again.</p>
          )}

          {!loading && !error && tasks.length === 0 && (
            <p className="text-sm text-muted py-8 text-center">No deleted tasks.</p>
          )}

          {!loading && !error && tasks.length > 0 && (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-column-bg px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{t.title}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">
                      Deleted {formatTimeAgo(t.deletedAt)}
                      {t.deletedByName ? ` by ${t.deletedByName}` : ""}
                      {(t.commentCount ?? 0) > 0 ? ` · ${t.commentCount} comment${t.commentCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => restore(t.id)}
                    disabled={restoringId === t.id || purgingId === t.id}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {restoringId === t.id ? "Restoring…" : "Restore"}
                  </button>
                  <button
                    onClick={() => setConfirmTarget(t)}
                    disabled={restoringId === t.id || purgingId === t.id}
                    aria-label={`Delete "${t.title}" forever`}
                    title="Delete forever"
                    className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/8 transition-colors disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && !error && tasks.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/60 flex-shrink-0">
            <p className="text-xs text-muted">{tasks.length} task{tasks.length === 1 ? "" : "s"} in trash</p>
            <button
              onClick={() => setConfirmTarget("all")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/40 text-red-500 hover:bg-red-500/8 transition-colors"
            >
              Empty trash
            </button>
          </div>
        )}
      </div>
    </div>

    <ConfirmModal
      isOpen={confirmTarget !== null}
      title={confirmTarget === "all" ? "Empty trash?" : "Delete forever?"}
      message={
        confirmTarget === "all"
          ? `Permanently delete all ${tasks.length} task${tasks.length === 1 ? "" : "s"} in the trash? This skips the 30-day restore window and can't be undone.`
          : `Permanently delete "${confirmTarget?.title ?? ""}"? This can't be undone.`
      }
      confirmLabel="Delete forever"
      danger
      onClose={() => setConfirmTarget(null)}
      onConfirm={() => { if (confirmTarget) return purge(confirmTarget); }}
    />
    </>
  );
}
