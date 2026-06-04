"use client";

import { useState, useEffect, useCallback } from "react";
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

interface Member {
  userId: string;
  role: string;
  groupId: string | null;
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
}

const LOBBY = "__lobby__";

function StudentChip({ member, dragging }: { member: Member; dragging?: boolean }) {
  const label = member.name || member.handle || member.email;
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card-bg border border-border/70 ${dragging ? "shadow-modal" : ""}`}>
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: member.color || "#4A90A4" }}
      >
        {(member.name || member.handle || "?").charAt(0).toUpperCase()}
      </span>
      <span className="text-xs text-ink truncate">{label}</span>
    </div>
  );
}

function DraggableStudent({ member }: { member: Member }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: member.userId });
  return (
    <div
      ref={setNodeRef}
      data-testid={`member-${member.userId}`}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-40" : ""}`}
    >
      <StudentChip member={member} />
    </div>
  );
}

function DropZone({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-testid={`zone-${id}`} className={`${className ?? ""} ${isOver ? "ring-2 ring-ink/30" : ""}`}>
      {children}
    </div>
  );
}

export default function RosterPanel({ classId, ownerId, onOpenBoard, onChanged }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  // Member pending a "kick from class" confirmation (lobby only).
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  // Group pending a delete confirmation (destructive — wipes the group board).
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<Group | null>(null);
  const { push } = useToasts();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setGroups(data.groups || []);
      }
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const students = members.filter((m) => m.role === "student");
  const staff = members.filter((m) => m.role === "educator" || m.role === "ta");
  const lobby = students.filter((m) => !m.groupId);

  const assign = async (userId: string, groupId: string | null) => {
    const prev = members;
    // optimistic
    setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, groupId } : m)));
    try {
      const res = await fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, groupId }),
      });
      if (!res.ok) throw new Error("assign failed");
      onChanged?.();
    } catch {
      setMembers(prev); // revert
      push({ title: "Couldn't move student", description: "Please try again." });
    }
  };

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
      const res = await fetch(`/api/classes/${classId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
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
      const res = await fetch(`/api/classes/${classId}/groups`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
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
      const res = await fetch(`/api/classes/${classId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, name: trimmed }),
      });
      if (!res.ok) throw new Error("rename failed");
      onChanged?.();
    } catch {
      setGroups(prev);
      push({ title: "Couldn't rename group", description: "Please try again." });
    }
  };

  const setRole = async (userId: string, role: "student" | "ta") => {
    const prev = members;
    setMembers((ms) => ms.map((m) => (m.userId === userId ? { ...m, role } : m)));
    try {
      const res = await fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("role failed");
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't update role", description: "Please try again." });
    }
  };

  const removeMember = async (userId: string) => {
    const prev = members;
    setMembers((ms) => ms.filter((m) => m.userId !== userId));
    try {
      const res = await fetch(`/api/classes/${classId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, remove: true }),
      });
      if (!res.ok) throw new Error("remove failed");
      onChanged?.();
    } catch {
      setMembers(prev);
      push({ title: "Couldn't remove student", description: "Please try again." });
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading roster…</div>;
  }

  const activeMember = members.find((m) => m.userId === activeId) || null;

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
      {/* Staff */}
      {staff.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Teachers</h3>
          <div className="flex flex-wrap gap-2">
            {staff.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-column-bg border border-border/60">
                <StudentChip member={m} />
                <span className="text-[10px] text-muted">{m.userId === ownerId ? "owner" : m.role}</span>
                {m.userId !== ownerId && (
                  <button onClick={() => setRole(m.userId, "student")} className="text-[10px] text-muted hover:text-ink" title="Demote to student">↓</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Lobby */}
          <DropZone id={LOBBY} className="rounded-2xl border border-dashed border-border bg-column-bg/40 p-4 min-h-[120px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Lobby</h3>
              <span className="text-[11px] text-muted">{lobby.length} waiting</span>
            </div>
            <div className="space-y-2">
              {lobby.length === 0 ? (
                <p className="text-[11px] text-muted">Everyone has been placed.</p>
              ) : (
                lobby.map((m) => (
                  <div key={m.userId} className="group/chip flex items-center gap-1">
                    <div className="flex-1 min-w-0"><DraggableStudent member={m} /></div>
                    <button onClick={() => setConfirmRemove(m)} className="opacity-0 group-hover/chip:opacity-100 text-[11px] text-muted hover:text-red-500 transition-opacity" title="Remove from class">✕</button>
                  </div>
                ))
              )}
            </div>
          </DropZone>

          {/* Groups */}
          {groups.map((g) => {
            const groupStudents = students.filter((m) => m.groupId === g.id);
            return (
              <DropZone key={g.id} id={g.id} className="rounded-2xl border border-border/70 bg-card-bg p-4 min-h-[120px]">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <input
                    defaultValue={g.name}
                    onBlur={(e) => { if (e.target.value.trim() !== g.name) renameGroup(g.id, e.target.value); }}
                    className="text-sm font-semibold text-ink bg-transparent outline-none focus:bg-column-bg rounded px-1 -ml-1 min-w-0 flex-1"
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onOpenBoard({ id: g.id, name: g.name, boardId: g.boardId })} className="text-[11px] text-muted hover:text-ink" title="Open board">Open</button>
                    <button onClick={() => setConfirmDeleteGroup(g)} className="text-[11px] text-muted hover:text-red-500" title="Delete group">✕</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupStudents.length === 0 ? (
                    <p className="text-[11px] text-muted">Drag students here.</p>
                  ) : (
                    groupStudents.map((m) => (
                      <div key={m.userId} className="group/chip flex items-center gap-1">
                        <div className="flex-1 min-w-0"><DraggableStudent member={m} /></div>
                        <button onClick={() => assign(m.userId, null)} className="opacity-0 group-hover/chip:opacity-100 text-[11px] text-muted hover:text-ink transition-opacity" title="Move back to lobby">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </DropZone>
            );
          })}

          {/* Add group */}
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
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-ink text-card-bg hover:opacity-95 transition-opacity disabled:opacity-40"
            >
              + Add group
            </button>
          </div>
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
            ? `"${confirmDeleteGroup.name}" and its board — including all of the group's tasks — will be permanently deleted. Students in it return to the lobby. This cannot be undone.`
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
