"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface Props {
  boardName: string;
  boardId: string;
}

// ── Types ─────────────────────────────────────────────────────

interface PhaseStats {
  id: string;
  label: string;
  order: number;
  isDone: boolean;
  currentTaskCount: number;
  avgPhaseTimeMs: number | null;
  longestStagnantMs: number | null;
  longestStagnantTitle: string | null;
}

interface TaskDetail {
  id: string;
  title: string;
  assignee: string;
  priority: string;
  columnId: string;
  columnLabel: string;
  columnIsDone: boolean;
  createdAt: string;
  completedAt: string | null;
  deadline: string | null;
  commentCount: number;
  cycleTimeMs: number | null;
  currentPhaseMs: number;
  totalAgeMs: number;
  visitedColumnCount: number;
}

interface SuspiciousTask {
  id: string;
  title: string;
  assignee: string;
  cycleTimeMs: number;
  visitedColumnCount: number;
  isSpeedRun: boolean;
  isColumnSkip: boolean;
}

interface AssigneeRow {
  name: string;
  total: number;
  completed: number;
  overdue: number;
  avgCycleTimeMs: number | null;
}

interface AnalyticsData {
  columns: PhaseStats[];
  tasks: TaskDetail[];
  assignees: AssigneeRow[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    avgCycleTimeMs: number | null;
    stagnantCount: number;
    stagnantRate: number;
    commentDensity: number;
    deadlineAdherence: { onTime: number; total: number } | null;
    suspiciousTasks: SuspiciousTask[];
  };
}

type SortKey = "currentPhaseMs" | "totalAgeMs" | "priority" | "commentCount" | "title";
type FilterKey = "all" | "active" | "overdue" | "unassigned";

// ── Helpers ───────────────────────────────────────────────────

const MS_DAY = 86_400_000;

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1m";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < MS_DAY) return `${Math.floor(ms / 3_600_000)}h`;
  const days = ms / MS_DAY;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-500",
  high: "bg-orange-500/10 text-orange-500",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-blue-500/10 text-blue-500",
};
const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-green-400",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Med", low: "Low",
};

function phaseHealthColor(avgMs: number | null): string {
  if (avgMs === null) return "text-muted";
  const days = avgMs / MS_DAY;
  if (days < 2) return "text-green-600";
  if (days < 4) return "text-yellow-600";
  if (days < 7) return "text-orange-500";
  return "text-red-500";
}

function phaseHealthBadge(
  avgMs: number | null,
  isDone: boolean
): { label: string; cls: string } {
  if (isDone) return { label: "Done", cls: "bg-green-100 text-green-700" };
  if (avgMs === null) return { label: "No data", cls: "bg-border text-muted" };
  const days = avgMs / MS_DAY;
  if (days < 2) return { label: "Healthy",  cls: "bg-green-100 text-green-700" };
  if (days < 4) return { label: "Moderate", cls: "bg-yellow-100 text-yellow-700" };
  if (days < 7) return { label: "Slow",     cls: "bg-orange-100 text-orange-600" };
  return { label: "At Risk", cls: "bg-red-100 text-red-600" };
}

// ── Component ─────────────────────────────────────────────────

export default function AnalyticsPanel({ boardName, boardId }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?boardId=${boardId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetched(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    let list = [...data.tasks];
    if (filter === "active") list = list.filter((t) => !t.columnIsDone);
    if (filter === "overdue") list = list.filter((t) => t.deadline && new Date(t.deadline).getTime() < now && !t.columnIsDone);
    if (filter === "unassigned") list = list.filter((t) => !t.assignee);
    list.sort((a, b) => {
      // Completed tasks always float to the top
      const doneA = a.columnIsDone ? 0 : 1;
      const doneB = b.columnIsDone ? 0 : 1;
      if (doneA !== doneB) return doneA - doneB;
      // Within each group, apply the active sort key
      let diff = 0;
      if (sortKey === "currentPhaseMs") diff = a.currentPhaseMs - b.currentPhaseMs;
      else if (sortKey === "totalAgeMs") diff = a.totalAgeMs - b.totalAgeMs;
      else if (sortKey === "priority") diff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      else if (sortKey === "commentCount") diff = a.commentCount - b.commentCount;
      else if (sortKey === "title") diff = a.title.localeCompare(b.title);
      return sortDir === "asc" ? diff : -diff;
    });
    return list;
  }, [data, filter, sortKey, sortDir]);

  const hasAssignees = useMemo(() => data?.tasks.some((t) => t.assignee) ?? false, [data]);

  if (loading && !data) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading analytics…</div>;
  }
  if (!data) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Failed to load analytics.</div>;
  }

  const { summary, columns, assignees } = data;

  return (
    <div className="flex-1 overflow-y-auto px-10 py-8 no-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-ink">Analytics</h2>
          <p className="text-sm text-muted mt-0.5">{boardName}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-muted">
              Updated {lastFetched.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-card-bg border border-border text-ink hover:bg-border transition-colors disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <SummaryCard label="Total tasks" value={String(summary.total)} sub="" />
        <SummaryCard label="Completed" value={String(summary.completed)} sub={summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}%` : "0%"} valueColor="text-green-600" />
        <SummaryCard label="In progress" value={String(summary.inProgress)} sub="" valueColor="text-blue-600" />
        <SummaryCard label="Overdue" value={String(summary.overdue)} sub="" valueColor={summary.overdue > 0 ? "text-red-500" : "text-ink"} />
        <SummaryCard label="Avg cycle time" value={summary.avgCycleTimeMs !== null ? formatDuration(summary.avgCycleTimeMs) : "—"} sub="to complete" />
      </div>

      {/* Phase Health */}
      <Section title="Phase Health">
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th align="left">Phase</Th>
                <Th align="right">Tasks</Th>
                <Th align="right">Avg time here</Th>
                <Th align="left">Longest in column</Th>
                <Th align="right">Health</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {columns.map((col) => {
                const badge = phaseHealthBadge(col.avgPhaseTimeMs, col.isDone);
                return (
                  <tr key={col.id} className="hover:bg-border/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink">{col.label}</td>
                    <td className="px-4 py-3 text-right text-muted">{col.currentTaskCount}</td>
                    <td className={`px-4 py-3 text-right text-xs font-mono ${col.isDone ? "text-muted" : phaseHealthColor(col.avgPhaseTimeMs)}`}>
                      {col.avgPhaseTimeMs === null ? <span className="text-muted font-sans">—</span> : formatDuration(col.avgPhaseTimeMs)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {!col.longestStagnantTitle ? "—" : (
                        <span>
                          <span className={`${!col.isDone && (col.longestStagnantMs ?? 0) > 7 * MS_DAY ? "text-red-500" : "text-ink"} truncate max-w-[160px] inline-block align-bottom`}>
                            {col.longestStagnantTitle}
                          </span>
                          <span className="text-muted ml-1.5 text-xs">{formatDuration(col.longestStagnantMs!)}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">
          "Avg time here" reflects completed phase transitions. Data accumulates as tasks move between phases.
        </p>
      </Section>

      {/* Project Health */}
      <Section title="Project Health">
        <div className="grid grid-cols-3 gap-4">
          <HealthMetric
            label="Stagnant tasks"
            value={`${summary.stagnantCount} task${summary.stagnantCount !== 1 ? "s" : ""}`}
            sub={`${Math.round(summary.stagnantRate * 100)}% of active — stuck 3+ days`}
            color={summary.stagnantRate > 0.3 ? "text-red-500" : summary.stagnantRate > 0.1 ? "text-yellow-600" : "text-green-600"}
          />
          <HealthMetric
            label="Comment density"
            value={summary.commentDensity.toFixed(1)}
            sub="avg comments per task"
            color={summary.commentDensity >= 1 ? "text-green-600" : "text-yellow-600"}
          />
          <HealthMetric
            label="Deadline adherence"
            value={summary.deadlineAdherence ? `${summary.deadlineAdherence.onTime}/${summary.deadlineAdherence.total}` : "—"}
            sub={summary.deadlineAdherence ? `${Math.round((summary.deadlineAdherence.onTime / summary.deadlineAdherence.total) * 100)}% completed on time` : "No completed tasks with deadline"}
            color={!summary.deadlineAdherence ? "text-muted" : summary.deadlineAdherence.onTime / summary.deadlineAdherence.total >= 0.7 ? "text-green-600" : "text-red-500"}
          />
        </div>
      </Section>

      {/* Integrity Check */}
      <Section title="Integrity Check">
        {summary.suspiciousTasks.length === 0 ? (
          <div className="bg-card-bg rounded-xl border border-border px-5 py-4 flex items-center gap-3">
            <span className="text-green-500 text-lg">✓</span>
            <span className="text-sm text-muted">No suspicious activity detected across completed tasks.</span>
          </div>
        ) : (
          <>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 flex items-start gap-3">
              <span className="text-red-500 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-red-700">
                  {summary.suspiciousTasks.length} completed task{summary.suspiciousTasks.length !== 1 ? "s" : ""} flagged for review
                </p>
                <p className="text-xs text-red-500 mt-0.5">
                  Flags indicate tasks completed unusually fast (&lt; 30 min) or that bypassed intermediate columns.
                </p>
              </div>
            </div>
            <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <Th align="left">Task</Th>
                    <Th align="left">Assignee</Th>
                    <Th align="right">Cycle time</Th>
                    <Th align="right">Columns visited</Th>
                    <Th align="left">Flags</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.suspiciousTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-border/30 transition-colors">
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="truncate block font-medium text-ink" title={t.title}>{t.title}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{t.assignee || <span className="italic">none</span>}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-red-500 font-semibold">
                        {formatDuration(t.cycleTimeMs)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted">
                        {t.visitedColumnCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.isSpeedRun && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              Speed-run
                            </span>
                          )}
                          {t.isColumnSkip && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                              Skipped column
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* Tasks table */}
      <Section title="All Tasks">
        <div className="flex items-center gap-2 mb-3">
          {(["all", "active", "overdue", "unassigned"] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "bg-ink text-paper border-ink" : "bg-card-bg border-border text-muted hover:text-ink"}`}
            >
              {f === "all" ? `All (${data.tasks.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted">{filteredTasks.length} shown</span>
        </div>
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <SortTh label="Title" k="title" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                  <Th align="left">Assignee</Th>
                  <SortTh label="Priority" k="priority" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                  <Th align="left">Phase</Th>
                  <SortTh label="In phase" k="currentPhaseMs" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Age" k="totalAgeMs" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <Th align="left">Deadline</Th>
                  <SortTh label="Notes" k="commentCount" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">No tasks match this filter.</td></tr>
                ) : filteredTasks.map((t) => {
                  const now = Date.now();
                  const isOverdue = t.deadline && new Date(t.deadline).getTime() < now && !t.columnIsDone;
                  const isStagnant = !t.columnIsDone && t.currentPhaseMs > 3 * MS_DAY;
                  return (
                    <tr key={t.id} className={`hover:bg-border/30 transition-colors ${t.columnIsDone ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="truncate block text-ink font-medium" title={t.title}>{t.title}</span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{t.assignee || <span className="italic">none</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[t.priority] ?? ""}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? ""}`} />
                          {PRIORITY_LABEL[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${t.columnIsDone ? "text-green-600 font-bold" : "text-muted"}`}>{t.columnLabel}</td>
                      <td className={`px-4 py-3 text-right text-xs font-mono ${isStagnant ? "text-red-500 font-semibold" : "text-muted"}`}>
                        {formatDuration(t.currentPhaseMs)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-muted">{formatDuration(t.totalAgeMs)}</td>
                      <td className={`px-4 py-3 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted"}`}>
                        {formatDate(t.deadline)}{isOverdue ? " ⚠" : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted">{t.commentCount > 0 ? t.commentCount : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Team breakdown */}
      {hasAssignees && (
        <Section title="Team">
          <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th align="left">Member</Th>
                  <Th align="right">Tasks</Th>
                  <Th align="right">Done</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Overdue</Th>
                  <Th align="right">Avg cycle</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assignees.map((a) => {
                  const rate = a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0;
                  return (
                    <tr key={a.name} className="hover:bg-border/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">{a.name}</td>
                      <td className="px-4 py-3 text-right text-muted">{a.total}</td>
                      <td className="px-4 py-3 text-right text-green-600">{a.completed}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${rate >= 60 ? "text-green-600" : rate >= 30 ? "text-yellow-600" : "text-red-500"}`}>{rate}%</span>
                      </td>
                      <td className={`px-4 py-3 text-right text-xs ${a.overdue > 0 ? "text-red-500 font-medium" : "text-muted"}`}>
                        {a.overdue > 0 ? a.overdue : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-muted">
                        {a.avgCycleTimeMs !== null ? formatDuration(a.avgCycleTimeMs) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="h-8" />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Th({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted text-${align}`}>
      {children}
    </th>
  );
}

function SummaryCard({ label, value, sub, valueColor = "text-ink" }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <div className="bg-card-bg rounded-xl border border-border p-4">
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function HealthMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-card-bg rounded-xl border border-border p-4">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
      <div className="mt-1.5 text-xs font-medium text-ink">{label}</div>
    </div>
  );
}

function SortTh({ label, k, sortKey, dir, onSort, align }: { label: string; k: SortKey; sortKey: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; align: "left" | "right" }) {
  const active = sortKey === k;
  return (
    <th
      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none hover:text-ink transition-colors text-${align} ${active ? "text-ink" : "text-muted"}`}
      onClick={() => onSort(k)}
    >
      {label}
      {active ? <span className="ml-1 opacity-60">{dir === "asc" ? "↑" : "↓"}</span> : <span className="ml-1 opacity-20">↕</span>}
    </th>
  );
}
