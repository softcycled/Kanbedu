"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BoardChannel from "./BoardChannel";
import Skeleton from "../Skeleton";
import SharedAvatar from "../Avatar";

interface MonitorMember {
  id: string;
  name: string;
  handle: string | null;
  color: string;
}
interface MonitorGroup {
  groupId: string;
  name: string;
  boardId: string;
  realtimeSecret: string | null;
  total: number;
  done: number;
  percent: number;
  stalled: number;
  overdue: number;
  needsAttention: boolean;
  perColumn: { label: string; isDone: boolean; count: number }[];
  members: MonitorMember[];
}

interface Props {
  classId: string;
  onOpenBoard: (g: { id: string; name: string; boardId: string }) => void;
}

function Avatar({ member }: { member: MonitorMember }) {
  return (
    <div className="relative group/avatar hover:z-10">
      <SharedAvatar name={member.name || member.handle} color={member.color} size="md" className="ring-2 ring-card-bg" />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150">
        <div className="flex items-center gap-2 bg-[#1C1917] border border-white/10 rounded-xl px-3 py-2 shadow-lg whitespace-nowrap">
          <SharedAvatar name={member.name || member.handle} color={member.color} size="lg" />
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-white leading-tight">{member.name || member.handle || "Unknown"}</span>
            {member.handle && (
              <span className="text-[11px] text-white/50 leading-tight">@{member.handle}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Educator overview. Each card shows a group's OWN progress — intentionally no
// leaderboard or cross-group ranking. Attention cues are framed as help signals.
export default function MonitorPanel({ classId, onOpenBoard }: Props) {
  const [groups, setGroups] = useState<MonitorGroup[]>([]);
  const [stallDays, setStallDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // silent = background refresh (live realtime updates) that must not flash the
  // full-screen loading/error states over already-rendered cards.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/monitor`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to load monitor.");
      const data = await res.json();
      setGroups(data.groups || []);
      setStallDays(data.stallDays ?? 3);
    } catch (e: any) {
      if (!silent) setError(e?.message || "Failed to load monitor.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  // Coalesce bursts of board events (a student dragging several tasks) into one
  // refetch ~0.7s after activity settles.
  const reloadTimer = useRef<number | null>(null);
  const scheduleLiveReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => load(true), 700);
  }, [load]);
  useEffect(() => () => { if (reloadTimer.current) window.clearTimeout(reloadTimer.current); }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted">
        <p>{error}</p>
        <button onClick={() => load()} className="text-xs underline">Retry</button>
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted px-6 text-center">
        No groups yet. Create groups in the Roster tab. Each group gets its own board to track here.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
      {/* Live subscriptions: refresh when any group board changes. */}
      {groups.map((g) =>
        g.realtimeSecret ? (
          <BoardChannel key={g.groupId} secret={g.realtimeSecret} onSignal={scheduleLiveReload} />
        ) : null
      )}

      <div className="flex items-center justify-between mb-5 gap-4">
        <p className="text-xs text-muted">
          Each group&apos;s own progress. Orange marks a group that may need a hand.
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups…"
            className="w-36 bg-ink/5 border border-border/50 rounded-lg px-2.5 py-1 text-xs text-ink placeholder:text-muted outline-none focus:ring-1 focus:ring-ink/20 transition-all"
          />
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {(() => {
        const visible = search.trim()
          ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
          : groups;
        return visible.length === 0 ? (
          <p className="text-sm text-muted">No groups match &ldquo;{search}&rdquo;.</p>
        ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((g) => (
          <button
            key={g.groupId}
            onClick={() => onOpenBoard({ id: g.groupId, name: g.name, boardId: g.boardId })}
            className={`text-left rounded-2xl border p-5 transition-colors ${
              g.needsAttention
                ? "border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                : "border-border/70 bg-card-bg hover:bg-column-bg"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink truncate">{g.name}</h3>
              <span className="text-xs text-muted flex-shrink-0">{g.percent}%</span>
            </div>

            <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
              <div className={`h-full rounded-full ${g.needsAttention ? "bg-orange-400" : "bg-blue-400"}`} style={{ width: `${g.percent}%` }} />
            </div>

            <p className="mt-2 text-xs text-muted">{g.done} of {g.total} tasks done</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.perColumn.map((c, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-ink/5 text-ink/70">
                  {c.label} {c.count}
                </span>
              ))}
            </div>

            {(g.stalled > 0 || g.overdue > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {g.overdue > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                    {g.overdue} overdue
                  </span>
                )}
                {g.stalled > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                    {g.stalled} stalled &gt;{stallDays}d
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center">
              {g.members.length === 0 ? (
                <span className="text-[11px] text-muted">No members yet</span>
              ) : (
                <div className="flex -space-x-1.5">
                  {g.members.slice(0, 6).map((m) => <Avatar key={m.id} member={m} />)}
                  {g.members.length > 6 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium bg-ink/10 text-ink/70 ring-2 ring-card-bg">
                      +{g.members.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
