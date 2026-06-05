"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ClassSummary } from "../Sidebar";
import ConfirmModal from "../ConfirmModal";
import { useToasts } from "../Toasts";

const GroupBoardView = dynamic(() => import("./GroupBoardView"), { ssr: false, loading: () => <div /> });

interface Props {
  activeClass: ClassSummary;
  currentUserId: string;
  // Leaves the class server-side, then clears it from the shell. Returns false
  // if the request failed so the view can surface an error.
  onLeave: (classId: string) => Promise<boolean>;
}

// A student's class experience rendered INSIDE the main app shell (sidebar +
// content area), not the dedicated educator workspace. Shows the group board
// once the student is placed, otherwise a lobby waiting screen.
export default function StudentClassView({ activeClass, currentUserId, onLeave }: Props) {
  const { push } = useToasts();
  const [confirmLeave, setConfirmLeave] = useState(false);

  // ConfirmModal handles its own processing state and closes itself afterward;
  // we only surface a toast if the leave request fails.
  const leave = async () => {
    const ok = await onLeave(activeClass.id);
    if (!ok) push({ title: "Couldn't leave the class", description: "Please try again." });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Slim context bar: class name · group name · understated Class chip. */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 md:px-10 py-3 border-b border-border/60">
        <span className="text-xs text-muted truncate">{activeClass.name}</span>
        <span className="text-muted">/</span>
        <span className="text-sm font-semibold text-ink truncate">{activeClass.groupName || "Your group"}</span>
        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-ink/8 text-muted flex-shrink-0">Class</span>
        <button
          onClick={() => setConfirmLeave(true)}
          className="ml-auto flex-shrink-0 text-[11px] text-muted hover:text-red-500 transition-colors"
          title="Leave this class"
        >
          Leave class
        </button>
      </div>

      {activeClass.boardId ? (
        <GroupBoardView
          boardId={activeClass.boardId}
          boardName={activeClass.groupName || "Your group"}
          currentUserId={currentUserId}
          realtimeSecret={activeClass.realtimeSecret ?? null}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
          </div>
          <h2 className="text-base font-semibold text-ink">You&apos;re in {activeClass.name}</h2>
          <p className="text-sm text-muted mt-1 max-w-sm">Waiting to be placed into a group. Your teacher will assign you shortly — your group board will appear here.</p>
        </div>
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
