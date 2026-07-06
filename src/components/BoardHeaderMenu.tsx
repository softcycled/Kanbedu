"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useBoardResources from "@/hooks/useBoardResources";
import ConfirmModal from "./ConfirmModal";

interface Props {
  boardId: string;
  boardName: string;
  currentUserId?: string;
  onOpenSettings: () => void;
  variant?: "desktop" | "mobile";
}

// Discord-style board title: the board name doubles as a dropdown trigger for
// the quick actions (invite, full settings, leave). Only rendered for personal
// boards; class group boards pass their own headerTitle to <Board>, so this
// never appears there. Invite/leave logic mirrors SettingsPanel exactly.
export default function BoardHeaderMenu({ boardId, boardName, currentUserId, onOpenSettings, variant = "desktop" }: Props) {
  const router = useRouter();
  const { members, setMembersForBoard } = useBoardResources(boardId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Role resolves once members load from cache. Until then it's null, so we
  // don't flash "Leave board" for an owner who can never actually leave.
  const currentUserRole = members.find((m) => m.id === currentUserId)?.role ?? null;
  const canLeave = currentUserRole !== null && currentUserRole !== "owner";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // stopPropagation so Escape closes only the menu and doesn't bubble to any
    // board/workspace-level Escape handler.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleInvite = async () => {
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      if (!res.ok) return;
      const { token } = await res.json();
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore; nothing copied
    }
  };

  const performLeave = async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, { method: "DELETE" });
      if (!res.ok) return;
      setMembersForBoard((prev) => prev.filter((m) => m.id !== currentUserId));
      router.replace("/");
    } catch {
      // ignore; stay on the board
    }
  };

  const isMobile = variant === "mobile";
  // Desktop matches the old <h1> (shrink-0, no truncation, room to breathe);
  // mobile lives inside a flex-1 min-w-0 slot and must truncate.
  const titleClass = isMobile
    ? "text-base font-bold tracking-tight text-ink truncate"
    : "text-xl font-bold tracking-tight text-ink";

  return (
    <div ref={rootRef} className={`relative ${isMobile ? "min-w-0" : "shrink-0"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Board menu"
        className={`flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-lg hover:bg-ink/5 transition-colors ${isMobile ? "max-w-full min-w-0" : ""}`}
      >
        <span className={titleClass}>{boardName || "Board"}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[212px] rounded-xl border border-border bg-card-bg shadow-modal py-1.5 z-40">
          <button
            onClick={handleInvite}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink/80 hover:bg-ink/5 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-muted">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {copied ? "Link copied!" : "Invite to board"}
          </button>
          <button
            onClick={() => { setOpen(false); onOpenSettings(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink/80 hover:bg-ink/5 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-muted">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" />
            </svg>
            Board settings
          </button>
          {canLeave && (
            <>
              <div className="my-1 border-t border-border/60" />
              <button
                onClick={() => { setOpen(false); setLeaveConfirmOpen(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink/80 hover:text-red-500 hover:bg-red-500/8 transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Leave board
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={leaveConfirmOpen}
        title="Leave board?"
        message="Are you sure you want to leave this board? You will lose access."
        confirmLabel="Leave"
        danger
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={performLeave}
      />
    </div>
  );
}
