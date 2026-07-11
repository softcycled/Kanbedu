"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { ClassSummary } from "../Sidebar";
import ConfirmModal from "../ConfirmModal";
import { useToasts } from "../Toasts";
import { trackEvent } from "@/lib/analytics";
import { DropdownMenu, DropdownItem } from "../ui/DropdownMenu";

const GroupBoardView = dynamic(() => import("./GroupBoardView"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 overflow-hidden flex gap-7 px-10 pt-6" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-72 space-y-3">
          <div className="h-5 w-32 rounded-md bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="h-14 rounded-xl bg-border/30 dark:bg-border/20 motion-safe:animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  ),
});

interface Props {
  activeClass: ClassSummary;
  currentUserId: string;
  // Leaves the class server-side, then clears it from the shell. Returns false
  // if the request failed so the view can surface an error.
  onLeave: (classId: string) => Promise<boolean>;
  onOpenNav?: () => void;
}

// A student's class experience rendered INSIDE the main app shell (sidebar +
// content area), not the dedicated educator workspace. Shows the group board
// once the student is placed, otherwise a lobby waiting screen.
export default function StudentClassView({ activeClass, currentUserId, onLeave, onOpenNav }: Props) {
  const { push } = useToasts();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeClass.boardId) trackEvent("board_view", { boardType: "class" });
  }, [activeClass.boardId]);

  // ConfirmModal handles its own processing state and closes itself afterward;
  // we only surface a toast if the leave request fails.
  const leave = async () => {
    const ok = await onLeave(activeClass.id);
    if (!ok) push({ title: "Couldn't leave the class", description: "Please try again." });
  };

  // Header label doubles as a dropdown trigger (matches the personal-board
  // title menu): class name (muted) then group name (bold), wraps onto a
  // second line and stays compact when the names are long.
  const breadcrumb = (
    <div className="relative min-w-0">
      <button
        ref={titleRef}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Group board menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 -mx-1.5 px-1.5 py-0.5 rounded-lg hover:bg-ink/5 transition-colors text-left"
      >
        <span className="text-sm text-muted break-words">{activeClass.name}</span>
        {activeClass.groupName && (
          <>
            <span className="text-sm text-muted/60">/</span>
            <span className="text-lg font-bold tracking-tight text-ink break-words leading-tight">{activeClass.groupName}</span>
          </>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 self-center text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <DropdownMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={titleRef} className="w-[180px]">
        <DropdownItem
          danger
          onClick={() => { setMenuOpen(false); setConfirmLeave(true); }}
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          }
        >
          Leave class
        </DropdownItem>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {activeClass.boardId ? (
        // Board renders the single header row: breadcrumb title + filters + Leave.
        // Key by board id so switching to another class remounts with fresh state
        // instead of reusing the previous board's tasks/columns.
        <GroupBoardView
          key={activeClass.boardId}
          boardId={activeClass.boardId}
          boardName={activeClass.groupName || "Your group"}
          currentUserId={currentUserId}
          realtimeSecret={activeClass.realtimeSecret ?? null}
          headerTitle={breadcrumb}
          onOpenNav={onOpenNav}
        />
      ) : (
        <>
          {/* No board yet — a slim header carries the same context; Leave lives in the title's dropdown. */}
          <div className="flex-shrink-0 flex items-center gap-2 px-6 md:px-10 py-3 border-b border-border/60">
            {breadcrumb}
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
            </div>
            <h2 className="text-base font-semibold text-ink">You&apos;re in {activeClass.name}</h2>
            <p className="text-sm text-muted mt-1 max-w-sm">Waiting to be placed into a group. Your teacher will assign you shortly. Your group board will appear here.</p>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={confirmLeave}
        danger
        title="Leave this class?"
        message={`You'll lose access to ${activeClass.groupName ? `"${activeClass.groupName}"` : "your group board"} in ${activeClass.name}. You can rejoin later with the class link.`}
        confirmLabel="Leave class"
        onClose={() => setConfirmLeave(false)}
        onConfirm={leave}
      />
    </div>
  );
}
