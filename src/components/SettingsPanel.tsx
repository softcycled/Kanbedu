"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useBoardResources from "@/hooks/useBoardResources";
import { Board } from "@/lib/types";
import DeleteBoardModal from "./DeleteBoardModal";
import ConfirmModal from "./ConfirmModal";

interface Member {
  id: string;
  name: string;
  handle?: string | null;
  email: string;
  color: string;
  role: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  admin: { label: "Admin", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  member: { label: "Member", color: "text-muted bg-ink/5 border-border" },
};

interface ClassBoardSummary {
  classId: string;
  className: string;
  groupName: string | null;
  boardId: string;
}

interface Props {
  boards: Board[];
  activeBoardId: string;
  onUpdateBoard: (boardId: string, data: { name?: string }) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
  onReorder: (ids: string[]) => Promise<void>;
  currentUserId: string;
  classBoards?: ClassBoardSummary[];
  onSwitchToBoard?: (boardId: string) => void;
  onLeaveClass?: (classId: string) => Promise<boolean>;
  onClose?: () => void;
}

export default function SettingsPanel({
  boards,
  activeBoardId,
  onUpdateBoard,
  onDelete,
  onReorder,
  currentUserId,
  classBoards = [],
  onSwitchToBoard,
  onLeaveClass,
  onClose,
}: Props) {
  // Mobile drill-down: "list" shows the board list, "detail" shows the selected board
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoardId);
  const board = boards.find((b) => b.id === selectedBoardId) ?? boards[0];

  const [selectedClassBoardId, setSelectedClassBoardId] = useState<string | null>(null);
  const selectedClassBoard = classBoards.find((c) => c.boardId === selectedClassBoardId) ?? null;
  const [classBoardMembers, setClassBoardMembers] = useState<Member[]>([]);
  const [loadingClassMembers, setLoadingClassMembers] = useState(false);

  useEffect(() => {
    if (!selectedClassBoardId) { setClassBoardMembers([]); return; }
    setLoadingClassMembers(true);
    fetch(`/api/boards/${selectedClassBoardId}/members`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setClassBoardMembers(Array.isArray(data) ? data : []))
      .catch(() => setClassBoardMembers([]))
      .finally(() => setLoadingClassMembers(false));
  }, [selectedClassBoardId]);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(board?.name ?? "");
  const [isSavingName, setIsSavingName] = useState(false);

  const { members, loadingMembers, reloadMembers, setMembersForBoard } = useBoardResources(board?.id ?? null);

  const router = useRouter();

  const currentUserRole = members.find((m) => m.id === currentUserId)?.role ?? "member";

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveClassConfirmOpen, setLeaveClassConfirmOpen] = useState(false);
  const [isLeavingClass, setIsLeavingClass] = useState(false);

  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
  const [removeDropdownOpen, setRemoveDropdownOpen] = useState(false);
  const transferDropdownRef = useRef<HTMLDivElement>(null);
  const removeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!transferDropdownOpen && !removeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (transferDropdownOpen && transferDropdownRef.current && !transferDropdownRef.current.contains(e.target as Node)) {
        setTransferDropdownOpen(false);
      }
      if (removeDropdownOpen && removeDropdownRef.current && !removeDropdownRef.current.contains(e.target as Node)) {
        setRemoveDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [transferDropdownOpen, removeDropdownOpen]);

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

  // Perform transfer after user confirms
  const performTransfer = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer", toUserId: transferTarget }),
      });
      if (!res.ok) {
        console.error("Transfer failed", await res.text());
        alert("Failed to transfer ownership.");
        setIsTransferring(false);
        return;
      }
      setMembersForBoard((prev) => prev.map((m) => {
        if (m.id === transferTarget) return { ...m, role: "owner" };
        if (m.id === currentUserId) return { ...m, role: "member" };
        return m;
      }));
      setTransferTarget(null);
    } catch (err) {
      console.error(err);
      alert("Failed to transfer ownership.");
    } finally {
      setIsTransferring(false);
    }
  };

  const performRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: removeTarget }),
      });
      if (!res.ok) {
        console.error("Remove failed", await res.text());
        alert("Failed to remove member.");
        setIsRemoving(false);
        return;
      }
      setMembersForBoard((prev) => prev.filter((m) => m.id !== removeTarget));
      setRemoveTarget(null);
    } catch (err) {
      console.error(err);
      alert("Failed to remove member.");
    } finally {
      setIsRemoving(false);
    }
  };

  const performLeave = async () => {
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/members`, { method: "DELETE" });
      if (!res.ok) {
        console.error("Failed to leave board", await res.text());
        alert("Failed to leave board.");
        setIsLeaving(false);
        return;
      }
      setMembersForBoard((prev) => prev.filter((m) => m.id !== currentUserId));
      if (activeBoardId === board.id) router.replace("/");
    } catch (err) {
      console.error(err);
      alert("Failed to leave board.");
    } finally {
      setIsLeaving(false);
    }
  };

  const performLeaveClass = async () => {
    if (!selectedClassBoard || !onLeaveClass) return;
    setIsLeavingClass(true);
    const ok = await onLeaveClass(selectedClassBoard.classId).catch(() => false);
    setIsLeavingClass(false);
    if (ok) setSelectedClassBoardId(null);
  };

  if (!board && !selectedClassBoard) return null;

  const boardListItems = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted px-3 mb-3">Your Boards</p>
      {boards.map((b) => (
        <button
          key={b.id}
          onClick={() => { setSelectedBoardId(b.id); setSelectedClassBoardId(null); setMobileView("detail"); }}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            selectedBoardId === b.id && !selectedClassBoardId
              ? "bg-ink/8 text-ink font-medium"
              : "text-ink/70 hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: "#4A90A4" }}>
            {b.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{b.name}</span>
        </button>
      ))}
      {classBoards.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted px-3 mt-5 mb-3">Class Boards</p>
          {classBoards.map((c) => (
            <button
              key={c.classId}
              onClick={() => { setSelectedClassBoardId(c.boardId); setMobileView("detail"); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedClassBoardId === c.boardId
                  ? "bg-ink/8 text-ink font-medium"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: "#6B7A8D" }}>
                {(c.groupName || c.className).charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{c.groupName || c.className}</span>
            </button>
          ))}
        </>
      )}
    </>
  );

  const selectedName = selectedClassBoard
    ? (selectedClassBoard.groupName || selectedClassBoard.className)
    : board?.name ?? "";

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-8 md:pb-12">

        {/* ── Mobile: list view ── */}
        {mobileView === "list" && (
          <div className="md:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-sm font-semibold text-ink">Boards</span>
              {onClose && (
                <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors" aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="px-3 pt-4">
              {boardListItems}
            </div>
          </div>
        )}

        {/* ── Mobile: detail view ── */}
        {mobileView === "detail" && (
          <div className="md:hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
              <button
                onClick={() => setMobileView("list")}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors"
                aria-label="Back to boards list"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span className="text-sm font-semibold text-ink truncate">{selectedName}</span>
            </div>
          </div>
        )}

        {/* ── Desktop: side-by-side layout ── */}
        <div className={`flex flex-col md:flex-row min-h-0 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {/* Desktop board list sidebar */}
          <div className="md:w-52 flex-shrink-0 md:border-r border-border/60 md:py-7 md:px-2 hidden md:block">
            {boardListItems}
          </div>

          {/* Class board detail — read-only view when a class board is selected */}
          {selectedClassBoard && (
            <div className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-xl space-y-8">
              <section>
                <div className="flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                    style={{ backgroundColor: "#6B7A8D" }}
                  >
                    {(selectedClassBoard.groupName || selectedClassBoard.className).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-ink truncate">
                      {selectedClassBoard.groupName || selectedClassBoard.className}
                    </h3>
                    {selectedClassBoard.groupName && (
                      <p className="text-xs text-muted mt-0.5">{selectedClassBoard.className}</p>
                    )}
                    <p className="text-xs text-muted mt-0.5">{classBoardMembers.length} member{classBoardMembers.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </section>

              {onSwitchToBoard && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Board</h4>
                <div className="flex items-center gap-3 p-4 bg-card-bg border border-border rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">Go to group board</p>
                    <p className="text-xs text-muted mt-0.5">View and work on your group&apos;s tasks</p>
                  </div>
                  <button
                    onClick={() => onSwitchToBoard(selectedClassBoard.boardId)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
                  >
                    Open board
                  </button>
                </div>
              </section>
              )}

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                  Members ({classBoardMembers.length})
                </h4>
                <div className="bg-card-bg border border-border rounded-xl overflow-hidden">
                  {loadingClassMembers ? (
                    <div className="px-4 py-6 text-center text-xs text-muted">Loading…</div>
                  ) : classBoardMembers.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted">No members found.</div>
                  ) : (
                    classBoardMembers.map((member, i) => {
                      const isTeacher = member.role === "owner" || member.role === "admin";
                      const roleInfo = isTeacher
                        ? { label: "Teacher", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" }
                        : { label: "Student", color: "text-muted bg-ink/5 border-border" };
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center gap-3 px-4 py-3 ${i < classBoardMembers.length - 1 ? "border-b border-border/60" : ""}`}
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
              </section>

              {onLeaveClass && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-red-500/60 mb-3">Danger Zone</h4>
                <div className="bg-card-bg border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">Leave class</p>
                      <p className="text-xs text-muted mt-0.5">You can rejoin later with the class code.</p>
                    </div>
                    <button
                      onClick={() => setLeaveClassConfirmOpen(true)}
                      disabled={isLeavingClass}
                      className="flex-shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-lg border border-border text-ink hover:bg-ink/5 transition-colors disabled:opacity-40"
                    >
                      {isLeavingClass ? "Leaving…" : "Leave"}
                    </button>
                  </div>
                </div>
              </section>
              )}
            </div>
          )}

          {/* Personal board detail — only rendered when no class board is selected */}
          {!selectedClassBoard && board && (
          <div className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-xl space-y-8">
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
                      aria-label="Board name"
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
                      {(currentUserRole === "owner" || currentUserRole === "admin") && (
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
                      )}
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex-shrink-0"
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
                Members ({members.length})
              </h4>
              <div className="bg-card-bg border border-border rounded-xl overflow-hidden">
                {loadingMembers ? (
                  <div className="px-4 py-6 text-center text-xs text-muted">Loading…</div>
                ) : members.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted">No members found.</div>
                ) : (
                  members.map((member, i) => {
                    const roleInfo = ROLE_LABELS[member.role ?? "member"] ?? ROLE_LABELS.member;
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
            </section>

            {/* Danger zone */}
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-red-500/60 mb-3">Danger Zone</h4>
              <div className="bg-card-bg border border-border rounded-xl overflow-hidden">

                {/* Transfer ownership row */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3.5 gap-3 ${currentUserRole !== "owner" ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Transfer ownership</p>
                    <p className="text-xs text-muted mt-0.5">Pass board ownership to another member.</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <div ref={transferDropdownRef} className="relative flex-1 sm:flex-none sm:w-44">
                      <button
                        type="button"
                        onClick={() => setTransferDropdownOpen((v) => !v)}
                        disabled={currentUserRole !== "owner"}
                        className="w-full bg-column-bg rounded-xl px-3 py-2 text-sm text-ink border border-transparent hover:border-border transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        {transferTarget ? (
                          (() => {
                            const m = members.find((m) => m.id === transferTarget);
                            return m ? (
                              <>
                                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate">{m.name}</span>
                              </>
                            ) : <span className="text-muted">Select member</span>;
                          })()
                        ) : <span className="text-muted">Select member</span>}
                        <svg className="ml-auto flex-shrink-0 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4"/></svg>
                      </button>
                      {transferDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                          {members.filter((m) => m.role !== "owner" && m.id !== currentUserId).length === 0 ? (
                            <p className="px-4 py-2.5 text-xs text-muted">No other members</p>
                          ) : members.filter((m) => m.role !== "owner" && m.id !== currentUserId).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setTransferTarget(m.id); setTransferDropdownOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                transferTarget === m.id ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
                              }`}
                            >
                              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                                {m.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setTransferConfirmOpen(true)}
                      disabled={!transferTarget || currentUserRole !== "owner" || isTransferring}
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-border text-ink hover:bg-ink/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isTransferring ? "Transferring…" : "Transfer"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/60 mx-4" />

                {/* Remove member row */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3.5 gap-3 ${currentUserRole !== "owner" ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Remove member</p>
                    <p className="text-xs text-muted mt-0.5">Revoke a member's access to this board.</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <div ref={removeDropdownRef} className="relative flex-1 sm:flex-none sm:w-44">
                      <button
                        type="button"
                        onClick={() => setRemoveDropdownOpen((v) => !v)}
                        disabled={currentUserRole !== "owner"}
                        className="w-full bg-column-bg rounded-xl px-3 py-2 text-sm text-ink border border-transparent hover:border-border transition-colors cursor-pointer text-left flex items-center gap-2"
                      >
                        {removeTarget ? (
                          (() => {
                            const m = members.find((m) => m.id === removeTarget);
                            return m ? (
                              <>
                                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate">{m.name}</span>
                              </>
                            ) : <span className="text-muted">Select member</span>;
                          })()
                        ) : <span className="text-muted">Select member</span>}
                        <svg className="ml-auto flex-shrink-0 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4 4 4-4"/></svg>
                      </button>
                      {removeDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden">
                          {members.filter((m) => m.role !== "owner" && m.id !== currentUserId).length === 0 ? (
                            <p className="px-4 py-2.5 text-xs text-muted">No other members</p>
                          ) : members.filter((m) => m.role !== "owner" && m.id !== currentUserId).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setRemoveTarget(m.id); setRemoveDropdownOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                removeTarget === m.id ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
                              }`}
                            >
                              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                                {m.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setRemoveConfirmOpen(true)}
                      disabled={!removeTarget || currentUserRole !== "owner" || isRemoving}
                      className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRemoving ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/60 mx-4" />

                {/* Leave board row */}
                <div className="flex items-center justify-between px-4 py-3.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Leave board</p>
                    <p className="text-xs text-muted mt-0.5">
                      {currentUserRole === "owner"
                        ? "Transfer ownership before leaving."
                        : "You will lose access to this board."}
                    </p>
                  </div>
                    <button
                      onClick={() => setLeaveConfirmOpen(true)}
                      disabled={currentUserRole === "owner" || isLeaving}
                      className="flex-shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-lg border border-border text-ink hover:bg-ink/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isLeaving ? "Leaving…" : "Leave"}
                    </button>
                </div>

                <div className="border-t border-border/60 mx-4" />

                {/* Delete board row */}
                <div className={`flex items-center justify-between px-4 py-3.5 gap-4 ${currentUserRole !== "owner" ? "opacity-40 pointer-events-none select-none" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Delete this board</p>
                    <p className="text-xs text-muted mt-0.5">Permanently removes the board and all its tasks.</p>
                  </div>
                  <button
                    onClick={() => setDeletingBoard(board)}
                    disabled={boards.length <= 1 || currentUserRole !== "owner"}
                    title={boards.length <= 1 ? "Create another board first to delete this one" : currentUserRole !== "owner" ? "Only the board owner can delete this board" : "Delete board"}
                    className="flex-shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </section>
          </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={leaveClassConfirmOpen}
        title="Leave this class?"
        message={`You'll lose access to ${selectedClassBoard?.groupName ? `"${selectedClassBoard.groupName}"` : "your group board"} in ${selectedClassBoard?.className ?? "this class"}. You can rejoin later with the class code.`}
        confirmLabel="Leave class"
        danger
        onClose={() => setLeaveClassConfirmOpen(false)}
        onConfirm={performLeaveClass}
      />

      <DeleteBoardModal
        board={deletingBoard}
        isOpen={deletingBoard !== null}
        onClose={() => setDeletingBoard(null)}
        onConfirmDelete={onDelete}
      />
      <ConfirmModal
        isOpen={transferConfirmOpen}
        title="Transfer ownership?"
        message="Transfer ownership? This will make the selected member the new owner."
        confirmLabel="Transfer"
        danger={false}
        onClose={() => setTransferConfirmOpen(false)}
        onConfirm={performTransfer}
      />

      <ConfirmModal
        isOpen={removeConfirmOpen}
        title="Remove member?"
        message="Remove member from board? This will revoke their access."
        confirmLabel="Remove"
        danger={true}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={performRemove}
      />

      <ConfirmModal
        isOpen={leaveConfirmOpen}
        title="Leave board?"
        message="Are you sure you want to leave this board? You will lose access."
        confirmLabel="Leave"
        danger={true}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={performLeave}
      />
    </>
  );
}
