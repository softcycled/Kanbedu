"use client";

import { useEffect } from "react";
import useBoardResources from "@/hooks/useBoardResources";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

// Read-only member list for a class group board. Students can already fetch
// this data (the members endpoint allows any board member, not just owners),
// this just gives them a place to see it without going through the full
// board-settings panel, which carries rename/leave/delete actions that don't
// belong in a student's hands.
export default function BoardMembersModal({ isOpen, onClose, boardId }: Props) {
  const { members, loadingMembers } = useBoardResources(isOpen ? boardId : null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-modal-open
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-card-bg rounded-2xl shadow-modal w-full max-w-sm motion-safe:animate-modal-in overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-sm font-semibold text-ink">Members{members.length > 0 ? ` (${members.length})` : ""}</p>
          <button onClick={onClose} className="p-1 -m-1 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto border-t border-border/60">
          {loadingMembers ? (
            <div className="px-5 py-8 text-center text-xs text-muted">Loading…</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted">No members found.</div>
          ) : (
            members.map((member, i) => {
              const isTeacher = member.classRole === "educator" || member.classRole === "ta";
              const roleInfo = isTeacher
                ? { label: "Teacher", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" }
                : { label: "Student", color: "text-muted bg-ink/5 border-border" };
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 px-5 py-3 ${i < members.length - 1 ? "border-b border-border/60" : ""}`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{member.name}</p>
                    <p className="text-xs text-muted truncate">{member.handle ? `@${member.handle}` : member.email}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
