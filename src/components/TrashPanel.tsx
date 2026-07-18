"use client";

import { useState, useEffect, useCallback } from "react";
import { Task } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import ConfirmModal from "./ConfirmModal";

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
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

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
    } finally {
      setRestoringId(null);
    }
  };

  const emptyTrash = async () => {
    try {
      const res = await fetch(`/api/tasks/deleted?boardId=${boardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Empty trash failed: ${res.status}`);
      setTasks([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
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
          <div className="flex items-center gap-3 flex-shrink-0">
            {!loading && !error && tasks.length > 0 && (
              <button
                onClick={() => setEmptyConfirmOpen(true)}
                className="text-xs font-medium text-muted hover:text-red-500 transition-colors"
              >
                Empty trash
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
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
                    disabled={restoringId === t.id}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {restoringId === t.id ? "Restoring…" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>

    <ConfirmModal
      isOpen={emptyConfirmOpen}
      title="Empty trash?"
      message={`Permanently delete ${tasks.length} task${tasks.length === 1 ? "" : "s"}? This skips the 30-day restore window and can't be undone.`}
      confirmLabel="Delete forever"
      danger
      onClose={() => setEmptyConfirmOpen(false)}
      onConfirm={emptyTrash}
    />
    </>
  );
}
