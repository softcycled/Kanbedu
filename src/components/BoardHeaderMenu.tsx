"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useBoardResources from "@/hooks/useBoardResources";
import ConfirmModal from "./ConfirmModal";
import { DropdownMenu, DropdownItem, DropdownDivider } from "./ui/DropdownMenu";
import AnalyticsMenuItem from "./AnalyticsMenuItem";

interface Props {
  boardId: string;
  boardName: string;
  currentUserId?: string;
  onOpenSettings: () => void;
  onOpenAnalytics?: () => void;
  variant?: "desktop" | "mobile";
}

// Discord-style board title: the board name doubles as a dropdown trigger for
// the quick actions (invite, full settings, leave). Only rendered for personal
// boards; class group boards pass their own headerTitle to <Board>, so this
// never appears there. Invite/leave logic mirrors SettingsPanel exactly.
export default function BoardHeaderMenu({ boardId, boardName, currentUserId, onOpenSettings, onOpenAnalytics, variant = "desktop" }: Props) {
  const router = useRouter();
  const { members, setMembersForBoard } = useBoardResources(boardId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Role resolves once members load from cache. Until then it's null, so we
  // don't flash "Leave board" for an owner who can never actually leave.
  const currentUserRole = members.find((m) => m.id === currentUserId)?.role ?? null;
  const canLeave = currentUserRole !== null && currentUserRole !== "owner";

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
    <div className={`relative ${isMobile ? "min-w-0" : "shrink-0"}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Board menu"
        aria-haspopup="menu"
        aria-expanded={open}
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

      <DropdownMenu open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} className="w-[212px]">
        <DropdownItem
          onClick={handleInvite}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          }
        >
          {copied ? "Link copied!" : "Invite to board"}
        </DropdownItem>
        <DropdownItem
          onClick={() => { setOpen(false); onOpenSettings(); }}
          icon={
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" />
            </svg>
          }
        >
          Board settings
        </DropdownItem>
        {onOpenAnalytics && (
          <AnalyticsMenuItem onSelect={() => { setOpen(false); onOpenAnalytics(); }} />
        )}
        {canLeave && (
          <>
            <DropdownDivider />
            <DropdownItem
              danger
              onClick={() => { setOpen(false); setLeaveConfirmOpen(true); }}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
            >
              Leave board
            </DropdownItem>
          </>
        )}
      </DropdownMenu>

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
