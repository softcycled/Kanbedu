"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BoardChannel from "./BoardChannel";
import Skeleton from "../Skeleton";
import SearchIcon from "../SearchIcon";
import { findGroupSuggestion } from "@/lib/groupSearch";

interface FlaggedTask {
  id: string;
  title: string;
  assignee: string;
  cycleTimeMs: number;
  visitedColumnCount: number;
  columnLabel: string;
  isSpeedRun: boolean;
  isColumnSkip: boolean;
  isMovedByOther: boolean;
  movedBy: string;
  skippedColumns: string[];
}
interface IntegrityGroup {
  groupId: string;
  name: string;
  boardId: string;
  realtimeSecret: string | null;
  flagged: FlaggedTask[];
}
interface IntegrityData {
  groups: IntegrityGroup[];
  totalFlagged: number;
  flaggedTeamCount: number;
  teamCount: number;
  speedRunMinutes: number;
}

type FlagFilter = "all" | "speedRun" | "columnSkip" | "movedByOther";
type SortOrder = "flagCount" | "alpha";

interface Props {
  classId: string;
  onOpenBoard: (g: { id: string; name: string; boardId: string }) => void;
  onFlagCount?: (n: number) => void;
  // Bumped by the parent whenever Roster creates/deletes a group, so Integrity
  // picks up the change without requiring a full page reload.
  reloadSignal?: number;
}

const MS_DAY = 86_400_000;
function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 60_000) return "< 1m";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < MS_DAY) return `${Math.floor(ms / 3_600_000)}h`;
  const days = ms / MS_DAY;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

function FlagChip({
  kind,
  tooltip,
}: {
  kind: "speedRun" | "columnSkip" | "movedByOther";
  tooltip?: string;
}) {
  const map = {
    speedRun: { label: "Speed-run", cls: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" },
    columnSkip: { label: "Skipped column", cls: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" },
    movedByOther: { label: "Moved by non-assignee", cls: "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400" },
  }[kind];

  if (!tooltip) {
    return (
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${map.cls}`}>
        {map.label}
      </span>
    );
  }

  return (
    <span className={`relative group/chip inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium cursor-default ${map.cls}`}>
      {map.label}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150">
        <span className="block whitespace-nowrap rounded-xl bg-[#1C1917] border border-white/10 px-3 py-2 text-xs text-white shadow-lg">
          {tooltip}
        </span>
      </span>
    </span>
  );
}

// Educator integrity overview across every group board in the class. One screen,
// grouped by team — surfaces tasks that look completed dishonestly so a teacher
// can check students are using the board properly. Not a ranking, not full stats.
export default function IntegrityPanel({ classId, onOpenBoard, onFlagCount, reloadSignal }: Props) {
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("flagCount");
  const [groupSearch, setGroupSearch] = useState("");

  // silent = background refresh from live realtime events; keeps the rendered
  // list in place instead of flashing the loading/error states.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/integrity`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to load integrity.");
      const d = await res.json();
      setData(d);
      onFlagCount?.(d.totalFlagged);
    } catch (e: any) {
      if (!silent) setError(e?.message || "Failed to load integrity.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);
  // Roster created/deleted a group — refetch without flashing the loading state.
  // Skip the first run so we don't double-fetch alongside the mount effect above.
  const skipFirstReload = useRef(true);
  useEffect(() => {
    if (reloadSignal === undefined) return;
    if (skipFirstReload.current) { skipFirstReload.current = false; return; }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  // Coalesce bursts of board activity into a single refetch.
  const reloadTimer = useRef<number | null>(null);
  const scheduleLiveReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => load(true), 700);
  }, [load]);
  useEffect(() => () => { if (reloadTimer.current) window.clearTimeout(reloadTimer.current); }, []);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
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
  if (!data || data.teamCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted px-6 text-center">
        No groups yet. Create groups in the Roster tab. Each group&apos;s board is checked here.
      </div>
    );
  }

  const flaggedGroups = data.groups.filter((g) => g.flagged.length > 0);
  const clearCount = data.teamCount - data.flaggedTeamCount;

  const displayGroups = flaggedGroups
    .map((g) => ({
      ...g,
      flagged: flagFilter === "all" ? g.flagged : g.flagged.filter((t) =>
        flagFilter === "speedRun" ? t.isSpeedRun :
        flagFilter === "columnSkip" ? t.isColumnSkip :
        t.isMovedByOther
      ),
    }))
    .filter((g) => g.flagged.length > 0)
    .filter((g) => {
      const q = groupSearch.trim().toLowerCase();
      if (!q) return true;
      const words = q.split(/\s+/).filter(Boolean);
      const haystack = [
        g.name,
        ...g.flagged.map((t) => t.title),
        ...g.flagged.map((t) => t.assignee),
      ].join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) =>
      sortOrder === "flagCount" ? b.flagged.length - a.flagged.length : a.name.localeCompare(b.name)
    );

  const groupSuggestion = groupSearch.trim()
    ? findGroupSuggestion(
        flaggedGroups.map((g) => g.name),
        groupSearch,
        new Set(displayGroups.map((g) => g.name))
      )
    : null;

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-4xl">
      {/* Live subscriptions: re-check integrity when any group board changes. */}
      {data.groups.map((g) =>
        g.realtimeSecret ? (
          <BoardChannel key={g.groupId} secret={g.realtimeSecret} onSignal={scheduleLiveReload} />
        ) : null
      )}

      <div className="flex items-start justify-between gap-4 mb-5">
        <p className="text-xs text-muted max-w-xl">
          Tasks that may have been completed dishonestly, finished suspiciously fast,
          moved straight to done without passing through
          earlier columns, or marked done by someone other than the assignee. Signals to check, not proof.
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {data.totalFlagged === 0 ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-6 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-400/15 text-emerald-600 text-base flex-shrink-0">✓</span>
          <div>
            <p className="text-sm font-medium text-ink">No flags across all {data.teamCount} {data.teamCount === 1 ? "team" : "teams"}.</p>
            <p className="text-xs text-muted mt-0.5">Every completed task looks like normal, honest progress.</p>
          </div>
        </div>
      ) : (
        <>
          {data.flaggedTeamCount > data.teamCount / 2 && (
            <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-5 py-4 mb-5 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-base flex-shrink-0">⚠</span>
              <p className="text-sm text-ink">
                <span className="font-semibold">{data.totalFlagged}</span> {data.totalFlagged === 1 ? "task" : "tasks"} flagged across{" "}
                <span className="font-semibold">{data.flaggedTeamCount}</span> of {data.teamCount} {data.teamCount === 1 ? "team" : "teams"}.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { id: "all", label: "All" },
                { id: "speedRun", label: "Speed-run" },
                { id: "columnSkip", label: "Skipped column" },
                { id: "movedByOther", label: "Moved by other" },
              ] as { id: FlagFilter; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFlagFilter(f.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                    flagFilter === f.id
                      ? "bg-ink text-paper"
                      : "bg-ink/8 text-ink/70 hover:bg-ink/12 hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex flex-col items-end gap-1">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Search groups…"
                    className="w-36 bg-ink/5 border border-border/60 hover:border-border focus:border-ink/30 focus:bg-column-bg rounded-lg pl-9 pr-3 py-1 text-sm text-ink placeholder:text-muted outline-none transition-colors"
                  />
                </div>
                {groupSuggestion && (
                  <button
                    onClick={() => setGroupSearch(groupSuggestion)}
                    className="text-[11px] text-muted hover:text-ink transition-colors"
                  >
                    Did you mean <span className="font-medium underline">{groupSuggestion}</span>?
                  </button>
                )}
              </div>
              <button
                onClick={() => setSortOrder((s) => s === "flagCount" ? "alpha" : "flagCount")}
                className="text-[11px] text-muted hover:text-ink transition-colors whitespace-nowrap"
              >
                {sortOrder === "flagCount" ? "Most flagged ↓" : "A–Z ↑"}
              </button>
            </div>
          </div>

          {displayGroups.length === 0 ? (
            <p className="text-sm text-muted py-4">No groups match this filter.</p>
          ) : (
          <div className="space-y-5">
            {displayGroups.map((g) => (
              <section key={g.groupId} className="rounded-2xl border border-border/70 bg-card-bg">
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-ink truncate">{g.name}</h3>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex-shrink-0">
                      {g.flagged.length} flagged
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenBoard({ id: g.groupId, name: g.name, boardId: g.boardId })}
                    className="text-sm text-muted hover:text-ink transition-colors flex-shrink-0"
                  >
                    Open board
                  </button>
                </div>
                <ul className="divide-y divide-border/50">
                  {g.flagged.map((t) => (
                    <li key={t.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate" title={t.title}>{t.title}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {t.assignee} · in {t.columnLabel}
                          {t.isSpeedRun && <> · done in <span className="font-mono text-red-600">{formatDuration(t.cycleTimeMs)}</span></>}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                        {t.isSpeedRun && <FlagChip kind="speedRun" />}
                        {t.isColumnSkip && (
                          <FlagChip
                            kind="columnSkip"
                            tooltip={t.skippedColumns.length > 0 ? `Skipped: ${t.skippedColumns.join(", ")}` : undefined}
                          />
                        )}
                        {t.isMovedByOther && (
                          <FlagChip
                            kind="movedByOther"
                            tooltip={t.movedBy ? `Moved by ${t.movedBy}` : undefined}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          )}

          {clearCount > 0 && (
            <p className="text-[11px] text-muted mt-5">
              {clearCount} other {clearCount === 1 ? "team" : "teams"} clear.
            </p>
          )}
        </>
      )}
    </div>
  );
}
