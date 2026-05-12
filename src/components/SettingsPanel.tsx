"use client";

import { useState, useEffect } from "react";
import useBoardResources from "@/hooks/useBoardResources";
import { Board } from "@/lib/types";
import DeleteBoardModal from "./DeleteBoardModal";

interface Member {
  id: string;
  name: string;
  email: string;
  color: string;
  role: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  admin: { label: "Admin", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  member: { label: "Member", color: "text-muted bg-ink/5 border-border" },
};

interface Props {
  boards: Board[];
  activeBoardId: string;
  onUpdateBoard: (boardId: string, data: { name?: string; githubRepo?: string | null }) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
}

export default function SettingsPanel({
  boards,
  activeBoardId,
  onUpdateBoard,
  onDelete,
}: Props) {
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoardId);
  const board = boards.find((b) => b.id === selectedBoardId) ?? boards[0];

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(board?.name ?? "");
  const [isSavingName, setIsSavingName] = useState(false);

  const { members, loadingMembers, reloadMembers, setMembersForBoard } = useBoardResources(board?.id ?? null);

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

  useEffect(() => {
    setNameValue(board?.name ?? "");
    setEditingName(false);
  }, [board?.id, board?.name]);

  // Members are provided via shared `useBoardResources` hook; no local fetch needed.

  const saveName = async () => {
    if (!nameValue.trim() || nameValue.trim() === board?.name) {
      setEditingName(false);
      setNameValue(board?.name ?? "");
      return;
    }
    setIsSavingName(true);
    try {
      await onUpdateBoard(board!.id, { name: nameValue.trim() });
    } finally {
      setIsSavingName(false);
      setEditingName(false);
    }
  };

  const handleInvite = async (boardId: string) => {
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      if (!res.ok) return;
      const { token } = await res.json();
      const url = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(url);
      setInvitingId(boardId);
      setTimeout(() => setInvitingId(null), 2500);
    } catch {
      // ignore
    }
  };

  if (!board) return null;

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-32 md:pb-12">
        <div className="px-6 md:px-10 pt-6 pb-5 border-b border-border/60">
          <h2 className="text-lg font-bold tracking-tight text-ink pl-14 md:pl-0">Boards</h2>
        </div>

        <div className="flex flex-col md:flex-row min-h-0">
          {/* Board list sidebar */}
          <div className="md:w-52 flex-shrink-0 border-b md:border-b-0 md:border-r border-border/60 py-3 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted px-2 mb-2">Your Boards</p>
            {boards.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBoardId(b.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedBoardId === b.id
                    ? "bg-ink/8 text-ink font-medium"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <div
                  className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: "#4A90A4" }}
                >
                  {b.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </div>

          {/* Board detail */}
          <div className="flex-1 px-6 md:px-8 py-6 max-w-xl space-y-8">
            {/* Identity */}
            <section>
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                  style={{ backgroundColor: "#4A90A4" }}
                >
                  {board.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <input
                      autoFocus
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") { setEditingName(false); setNameValue(board.name); }
                      }}
                      onBlur={saveName}
                      disabled={isSavingName}
                      className="w-full text-lg font-bold bg-transparent border-b border-accent outline-none text-ink"
                    />
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h3 className="text-lg font-bold text-ink truncate">{board.name}</h3>
                      <button
                        onClick={() => setEditingName(true)}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted"
                        title="Rename board"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted mt-0.5">
                    {members.length} member{members.length !== 1 ? "s" : ""}
                    {" · Created "}
                    {new Date(board.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            </section>

            {/* Invite */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Invite People</h4>
              <div className="flex items-center gap-3 p-4 bg-card-bg border border-border rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">Share an invite link</p>
                  <p className="text-xs text-muted mt-0.5">Anyone with the link can join this board</p>
                </div>
                <button
                  onClick={() => handleInvite(board.id)}
                  disabled={invitingId === board.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {invitingId === board.id ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Members */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                Members — {members.length}
              </h4>
              <div className="bg-card-bg border border-border rounded-xl overflow-hidden">
                {loadingMembers ? (
                  <div className="px-4 py-6 text-center text-xs text-muted">Loading…</div>
                ) : members.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted">No members found.</div>
                ) : (
                  members.map((member, i) => {
                    const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.member;
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 px-4 py-3 ${i < members.length - 1 ? "border-b border-border/60" : ""}`}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{member.name}</p>
                          <p className="text-xs text-muted truncate">{member.email}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Danger zone */}
            {boards.length > 1 && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-red-500/70 mb-3">Danger Zone</h4>
                <div className="flex items-center gap-3 p-4 bg-card-bg border border-red-500/20 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">Delete this board</p>
                    <p className="text-xs text-muted mt-0.5">Permanently removes the board and all its tasks</p>
                  </div>
                  <button
                    onClick={() => setDeletingBoard(board)}
                    className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <DeleteBoardModal
        board={deletingBoard}
        isOpen={deletingBoard !== null}
        onClose={() => setDeletingBoard(null)}
        onConfirmDelete={onDelete}
      />
    </>
  );
}
