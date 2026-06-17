"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import ConfirmModal from "../ConfirmModal";
import { useToasts } from "../Toasts";
import Skeleton from "../Skeleton";

interface Member {
  userId: string;
  role: string;
  groupId: string | null;
  displayName: string | null;
  name: string;
  handle: string | null;
  color: string;
  email: string;
}
interface Group {
  id: string;
  name: string;
  order: number;
  boardId: string;
  memberCount: number;
}

interface Props {
  classId: string;
  ownerId: string;
  onOpenBoard: (g: { id: string; name: string; boardId: string }) => void;
  onChanged?: () => void;
  // When the class is archived the roster is view-only.
  readOnly?: boolean;
}

const LOBBY = "__lobby__";
// Background refresh cadence so a teacher watching the lobby sees students join.
const POLL_MS = 12_000;

function StudentChip({ member, dragging, onRename }: { member: Member; dragging?: boolean; onRename?: (name: string | null) => void }) {
  const label = member.displayName || member.name || member.handle || member.email;
  const initials = (member.displayName || member.name || member.handle || "?").charAt(0).toUpperCase();
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card-bg border border-border/70 ${dragging ? "shadow-modal" : ""}`}>
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: member.color || "#4A90A4" }}
      >
        {initials}
      </span>
      {onRename ? (
        <label className="group/rename flex items-center gap-1 min-w-0 flex-1 cursor-text">
          <input
            key={member.displayName ?? ""}
            className="text-xs text-ink bg-transparent border-none outline-none cursor-text truncate min-w-0 flex-1"
            defaultValue={member.displayName ?? ""}
            placeholder={member.name || member.handle || member.email}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val === (member.displayName ?? "")) return;
              onRename(val || null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = member.displayName ?? "";
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Set display name"
          />
          <svg className="flex-shrink-0 text-muted opacity-0 group-hover/rename:opacity-100 transition-opacity" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </label>
      ) : (
        <span className="text-xs text-ink truncate">{label}</span>
      )}
    </div>
  );
}

function DraggableStudent({ member, disabled, onRename }: { member: Member; disabled?: boolean; onRename?: (name: string | null) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: member.userId, disabled });
  return (
    <div
      ref={setNodeRef}
      data-testid={`member-${member.userId}`}
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      className={`${disabled ? "" : "cursor-grab active:cursor-grabbing touch-none"} ${isDragging ? "opacity-40" : ""}`}
    >
      <StudentChip member={member} onRename={onRename} />
    </div>
  );
}

function DropZone({
  id,
  children,
  className,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} data-testid={`zone-${id}`} className={`${className ?? ""} ${isOver && !disabled ? "ring-2 ring-ink/30" : ""}`}>
      {children}
    </div>
  );
}

// Compact "assign to group" picker — the keyboard-accessible, no-drag path.
// Custom dropdown that fully matches the app's styling. A native <select> can't
// be used here because the OS renders its option popup (blue highlight, square
// corners) and ignores CSS — see FilterBar / ListView for the same pattern.
function RosterDropdown({
  value,
  options,
  onPick,
  placeholder = "Select",
  disabled = false,
  ariaLabel,
  align = "left",
}: {
  value: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 max-w-[8rem] text-xs rounded-xl border border-border/60 bg-paper text-ink py-1 pl-2.5 pr-2 outline-none focus:border-ink/30 cursor-pointer transition-colors hover:border-border disabled:opacity-50 disabled:cursor-default"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg
          aria-hidden
          className={`flex-shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-50 mt-1 min-w-[8rem] bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden`}
        >
          <div className="pb-1 max-h-60 overflow-y-auto no-scrollbar">
            {options.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onPick(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-column-bg text-ink font-medium" : "text-ink hover:bg-column-bg"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignSelect({
  value,
  groups,
  onPick,
}: {
  value: string;
  groups: Group[];
  onPick: (groupId: string | null) => void;
}) {
  const options = [
    { value: LOBBY, label: "Waiting" },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];
  return (
    <RosterDropdown
      value={value}
      options={options}
      onPick={(v) => onPick(v === LOBBY ? null : v)}
      ariaLabel="Assign to group"
      align="right"
    />
  );
}

export default function RosterPanel({ classId, ownerId, onOpenBoard, onChanged, readOnly = false }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  // Selected student ids for bulk assignment / distribution.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  // Member pending a "kick from class" confirmation (lobby only).
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  // Group pending a delete confirmation (destructive — wipes the group board).
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<Group | null>(null);
  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; matched: number; unmatched: number; groupsCreated: number; invited: number; inviteFailed: number; inviteCapped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { push } = useToasts();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setLoadError(false);
      }
      try {
        const res = await fetch(`/api/classes/${classId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
          setGroups(data.groups || []);
          if (silent) setLoadError(false);
        } else if (!silent) {
          setLoadError(true);
        }
      } catch {
        if (!silent) setLoadError(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classId]
  );

  useEffect(() => { load(); }, [load]);

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch(`/api/classes/${classId}/import`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Import failed.");
      } else {
        setImportResult(data);
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await load(true);
        onChanged?.();
      }
    } catch {
      setImportError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  // Tracks in-flight optimistic mutations so the background poll never reads
  // stale server data mid-write and reverts a change the teacher just made.
  const inflightRef = useRef(0);
  const tracked = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    inflightRef.current++;
    try {
      return await p;
    } finally {
      inflightRef.current--;
    }
  }, []);

  // Idle background poll so the lobby reflects new joins without a manual reload.
  // Pauses while dragging, mid-operation, or with an active multi-selection so it
  // never clobbers in-progress work or optimistic state.
  const idleRef = useRef({ activeId, selectedSize: selected.size, busy });
  useEffect(() => {
    idleRef.current = { activeId, selectedSize: selected.size, busy };
  }, [activeId, selected.size, busy]);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      const s = idleRef.current;
      if (s.activeId || s.selectedSize > 0 || s.busy || inflightRef.current > 0) return;
      load(true);
    };

    const start = () => { if (!iv) iv = setInterval(tick, POLL_MS); };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
    const onVisibility = () => { document.hidden ? stop() : start(); };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load]);

  const students = members.filter((m) => m.role === "student");
  const staff = members.filter((m) => m.role === "educator" || m.role === "ta");
  const lobby = students.filter((m) => !m.groupId);

  // Drop any selected ids that no longer point at a current student.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(members.filter((m) => m.role === "student").map((m) => m.userId));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [members]);

  const assign = async (userId: string, groupId: string | null) => {
    const prev = members;
    // optimistic
    setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, groupId } : m)));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, groupId }),
      }));
      if (!res.ok) throw new Error("assign failed");
      onChanged?.();
    } catch {
      setMembers(prev); // revert
      push({ title: "Couldn't move student", description: "Please try again." });
    }
  };

  // Assign many students at once (multi-select bulk action / auto-distribute).
  const batchAssign = async (assignments: { userId: string; groupId: string | null }[]) => {
    if (assignments.length === 0) return;
    const prev = members;
    const byUser = new Map(assignments.map((a) => [a.userId, a.groupId]));
    setMembers((ms) => ms.map((m) => (byUser.has(m.userId) ? { ...m, groupId: byUser.get(m.userId)! } : m)));
    setBusy(true);
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      }));
      if (!res.ok) throw new Error("batch failed");
      setSelected(new Set());
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't update students", description: "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const applyBulk = (target: string) => {
    if (!target || selected.size === 0) return;
    const groupId = target === LOBBY ? null : target;
    batchAssign([...selected].map((userId) => ({ userId, groupId })));
    setBulkTarget("");
  };

  const toggleSelect = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const allLobbySelected = lobby.length > 0 && lobby.every((m) => selected.has(m.userId));
  const toggleSelectLobby = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allLobbySelected) lobby.forEach((m) => next.delete(m.userId));
      else lobby.forEach((m) => next.add(m.userId));
      return next;
    });

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const userId = active.id as string;
    const target = over.id as string;
    const member = members.find((m) => m.userId === userId);
    if (!member) return;
    const newGroupId = target === LOBBY ? null : target;
    if ((member.groupId ?? null) === newGroupId) return;
    assign(userId, newGroupId);
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }));
      if (!res.ok) throw new Error("create failed");
      const g = await res.json();
      setGroups((prev) => [...prev, g]);
      setNewGroupName("");
      onChanged?.();
    } catch {
      push({ title: "Couldn't create group", description: "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    const prevGroups = groups;
    const prevMembers = members;
    // optimistic: remove the group, return its students to the lobby
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setMembers((prev) => prev.map((m) => (m.groupId === groupId ? { ...m, groupId: null } : m)));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/groups`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      }));
      if (!res.ok) throw new Error("delete failed");
      onChanged?.();
    } catch {
      setGroups(prevGroups);
      setMembers(prevMembers);
      push({ title: "Couldn't delete group", description: "Please try again." });
    }
  };

  const renameGroup = async (groupId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const prev = groups;
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, name: trimmed }),
      }));
      if (!res.ok) throw new Error("rename failed");
      onChanged?.();
    } catch {
      setGroups(prev);
      push({ title: "Couldn't rename group", description: "Please try again." });
    }
  };

  // Move a group one slot left/right and persist the new order.
  const moveGroup = async (groupId: string, dir: -1 | 1) => {
    const idx = groups.findIndex((g) => g.id === groupId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= groups.length) return;
    const prev = groups;
    const next = [...groups];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setGroups(next.map((g, i) => ({ ...g, order: i })));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((g) => g.id) }),
      }));
      if (!res.ok) throw new Error("reorder failed");
      onChanged?.();
    } catch {
      setGroups(prev);
      push({ title: "Couldn't reorder groups", description: "Please try again." });
    }
  };

  const setRole = async (userId: string, role: "student" | "ta") => {
    const prev = members;
    setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, role } : m)));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      }));
      if (!res.ok) throw new Error("role failed");
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't update role", description: "Please try again." });
    }
  };

  const renameStudent = async (userId: string, displayName: string | null) => {
    const prev = members;
    setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, displayName } : m)));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, displayName }),
      }));
      if (!res.ok) throw new Error("rename failed");
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't rename student", description: "Please try again." });
    }
  };

  const removeMember = async (userId: string) => {
    const prev = members;
    setMembers((ms) => ms.filter((m) => m.userId !== userId));
    try {
      const res = await tracked(fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, remove: true }),
      }));
      if (!res.ok) throw new Error("remove failed");
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't remove student", description: "Please try again." });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted">
        <p>Failed to load roster.</p>
        <button onClick={() => load()} className="text-xs underline">Retry</button>
      </div>
    );
  }

  const activeMember = members.find((m) => m.userId === activeId) || null;
  const interactive = !readOnly;

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-ink">Roster</h2>
          <span className="text-[11px] text-muted truncate">
            {students.length} student{students.length === 1 ? "" : "s"} · {lobby.length} waiting
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {interactive && (
            <button
              onClick={() => { setShowImport((v) => !v); setImportResult(null); setImportError(null); }}
              className="text-[11px] text-muted hover:text-ink transition-colors"
            >
              {showImport ? "Cancel" : "Import CSV"}
            </button>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-muted" title="The roster auto-updates as students join">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* CSV import panel */}
      {interactive && showImport && (
        <div className="mb-5 rounded-xl border border-border/60 bg-column-bg/40 p-4 space-y-3">
          <p className="text-[11px] text-muted leading-relaxed">
            Upload a CSV with <span className="font-mono bg-column-bg px-1 rounded">name</span> and <span className="font-mono bg-column-bg px-1 rounded">email</span> columns.
            Optional: add a <span className="font-mono bg-column-bg px-1 rounded">group</span> column to auto-create groups and sort students.
            Matched accounts get their display name set automatically.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); setImportError(null); }}
              className="text-xs text-ink file:mr-2 file:text-xs file:px-2.5 file:py-1 file:rounded-md file:border file:border-border/60 file:bg-card-bg file:text-ink file:cursor-pointer hover:file:bg-column-bg"
            />
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-on-primary disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
          {importError && <p className="text-[11px] text-red-500">{importError}</p>}
          {importResult && (
            <>
              <p className="text-[11px] text-emerald-500">
                {importResult.total} rows processed, {importResult.matched} matched
                {importResult.unmatched > 0 && `, ${importResult.unmatched} unmatched (will match when they join)`}
                {importResult.groupsCreated > 0 && `, ${importResult.groupsCreated} group${importResult.groupsCreated === 1 ? "" : "s"} created`}
                {importResult.invited > 0 && `, ${importResult.invited} invite email${importResult.invited === 1 ? "" : "s"} sent`}.
              </p>
              {importResult.inviteFailed > 0 && (
                <p className="text-[11px] text-amber-500 mt-0.5">
                  {importResult.inviteFailed} invite email{importResult.inviteFailed === 1 ? "" : "s"} failed to send. Check that your email service is configured.
                </p>
              )}
              {importResult.inviteCapped > 0 && (
                <p className="text-[11px] text-amber-500 mt-0.5">
                  {importResult.inviteCapped} student{importResult.inviteCapped === 1 ? "" : "s"} were added but not emailed (50-email limit per import). Import again to send the remaining invites.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {interactive && selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap rounded-xl border border-ink/15 bg-column-bg px-3 py-2">
          <span className="text-xs font-medium text-ink">{selected.size} selected</span>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Assign to
            <RosterDropdown
              value={bulkTarget}
              options={[
                { value: LOBBY, label: "Waiting" },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
              onPick={applyBulk}
              placeholder="Choose…"
              disabled={busy}
              ariaLabel="Assign selected students to group"
            />
          </label>
          <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted hover:text-ink ml-auto">
            Clear
          </button>
        </div>
      )}

      {/* Staff */}
      {staff.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Teachers</h3>
          <div className="flex flex-wrap gap-2">
            {staff.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-column-bg border border-border/60">
                <StudentChip member={m} />
                <span className="text-[10px] text-muted">{m.userId === ownerId ? "owner" : m.role}</span>
                {interactive && m.userId !== ownerId && (
                  <button onClick={() => setRole(m.userId, "student")} className="text-[10px] text-muted hover:text-ink" title="Demote to student">↓</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={interactive ? sensors : []}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Lobby */}
          <DropZone id={LOBBY} disabled={!interactive} className="rounded-2xl border border-dashed border-border bg-column-bg/40 p-4 min-h-[120px]">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {interactive && lobby.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allLobbySelected}
                    onChange={toggleSelectLobby}
                    className="w-3.5 h-3.5 rounded border-border accent-ink cursor-pointer flex-shrink-0"
                    title="Select everyone waiting"
                  />
                )}
                <h3 className="text-sm font-semibold text-ink">Waiting</h3>
              </div>
              <span className="text-[11px] text-muted flex-shrink-0">{lobby.length} waiting</span>
            </div>
            <div className="space-y-2">
              {lobby.length === 0 ? (
                <p className="text-[11px] text-muted">Everyone has been placed.</p>
              ) : (
                lobby.map((m) => (
                  <div key={m.userId} className="group/chip flex items-center gap-1.5">
                    {interactive && (
                      <input
                        type="checkbox"
                        checked={selected.has(m.userId)}
                        onChange={() => toggleSelect(m.userId)}
                        className="w-3.5 h-3.5 rounded border-border accent-ink cursor-pointer flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0"><DraggableStudent member={m} disabled={!interactive} onRename={interactive ? (name) => renameStudent(m.userId, name) : undefined} /></div>
                    {interactive && (
                      <>
                        <AssignSelect value={LOBBY} groups={groups} onPick={(gid) => assign(m.userId, gid)} />
                        <button onClick={() => setConfirmRemove(m)} className="opacity-0 group-hover/chip:opacity-100 text-[11px] text-muted hover:text-red-500 transition-opacity" title="Remove from class">✕</button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </DropZone>

          {/* Groups */}
          {groups.map((g, gi) => {
            const groupStudents = students.filter((m) => m.groupId === g.id);
            return (
              <DropZone key={g.id} id={g.id} disabled={!interactive} className="rounded-2xl border border-border/70 bg-card-bg p-4 min-h-[120px]">
                <div className="flex items-center justify-between mb-3 gap-2">
                  {interactive ? (
                    <label className="group/rename flex items-center gap-1 min-w-0 flex-1">
                      <input
                        key={g.name}
                        defaultValue={g.name}
                        onBlur={(e) => { if (e.target.value.trim() !== g.name) renameGroup(g.id, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="text-sm font-semibold text-ink bg-transparent outline-none focus:bg-column-bg rounded px-1 -ml-1 min-w-0 flex-1"
                      />
                      <svg className="flex-shrink-0 text-muted opacity-0 group-hover/rename:opacity-100 transition-opacity" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </label>
                  ) : (
                    <span className="text-sm font-semibold text-ink truncate min-w-0 flex-1">{g.name}</span>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {interactive && (
                      <>
                        <button onClick={() => moveGroup(g.id, -1)} disabled={gi === 0} className="text-[11px] text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted" title="Move left">◀</button>
                        <button onClick={() => moveGroup(g.id, 1)} disabled={gi === groups.length - 1} className="text-[11px] text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted" title="Move right">▶</button>
                      </>
                    )}
                    <button onClick={() => onOpenBoard({ id: g.id, name: g.name, boardId: g.boardId })} className="text-[11px] text-muted hover:text-ink" title="Open board">Open</button>
                    {interactive && (
                      <button onClick={() => setConfirmDeleteGroup(g)} className="text-[11px] text-muted hover:text-red-500" title="Delete group">✕</button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {groupStudents.length === 0 ? (
                    <p className="text-[11px] text-muted">{interactive ? "Drag or assign students here." : "No students."}</p>
                  ) : (
                    groupStudents.map((m) => (
                      <div key={m.userId} className="group/chip flex items-center gap-1.5">
                        {interactive && (
                          <input
                            type="checkbox"
                            checked={selected.has(m.userId)}
                            onChange={() => toggleSelect(m.userId)}
                            className="w-3.5 h-3.5 rounded border-border accent-ink cursor-pointer flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0"><DraggableStudent member={m} disabled={!interactive} onRename={interactive ? (name) => renameStudent(m.userId, name) : undefined} /></div>
                        {interactive && (
                          <AssignSelect value={g.id} groups={groups} onPick={(gid) => assign(m.userId, gid)} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </DropZone>
            );
          })}

          {/* Add group */}
          {interactive && (
            <div className="rounded-2xl border border-dashed border-border p-4 flex flex-col justify-center gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createGroup(); }}
                placeholder="New group name…"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-column-bg text-ink placeholder:text-muted/60 outline-none focus:border-ink/30"
              />
              <button
                onClick={createGroup}
                disabled={busy || !newGroupName.trim()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                + Add group
              </button>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeMember ? <StudentChip member={activeMember} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <ConfirmModal
        isOpen={!!confirmRemove}
        danger
        title="Remove from class?"
        message={
          confirmRemove
            ? `${confirmRemove.name || confirmRemove.handle || confirmRemove.email} will be removed from the class and lose access. You can re-invite them with the class link.`
            : ""
        }
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) await removeMember(confirmRemove.userId);
        }}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteGroup}
        danger
        title="Delete this group?"
        message={
          confirmDeleteGroup
            ? `"${confirmDeleteGroup.name}" and its board, including all of the group's tasks, will be permanently deleted. Students in it return to waiting. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete group"
        onClose={() => setConfirmDeleteGroup(null)}
        onConfirm={async () => {
          if (confirmDeleteGroup) await deleteGroup(confirmDeleteGroup.id);
        }}
      />
    </div>
  );
}
