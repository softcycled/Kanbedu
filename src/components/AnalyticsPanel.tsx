"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

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
  throughput: number;
  avgPhaseTimeMs: number | null;
  longestStagnantMs: number | null;
  longestStagnantTitle: string | null;
  isBottleneck: boolean;
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
  isMovedByOther: boolean;
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

type SortKey = "currentPhaseMs" | "totalAgeMs" | "priority" | "commentCount" | "title" | "assignee";
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

// ── Component ─────────────────────────────────────────────────

// ── Heatmap helpers ───────────────────────────────────────────

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekStart(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function formatWeekLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function heatColorBoard(count: number): string {
  if (count === 0) return "var(--color-column-bg, #EFEDE8)";
  if (count <= 1) return "#DBEafe";
  if (count <= 3) return "#93C5FD";
  if (count <= 6) return "#3B82F6";
  return "#1E40AF";
}

function buildHeatmapGrid(data: { date: string; value: number }[]) {
  const dayCounts: Record<string, number> = {};
  data.forEach((d) => (dayCounts[d.date] = (dayCounts[d.date] || 0) + d.value));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 52 * 7);
  start.setDate(start.getDate() - start.getDay());
  const weeks: { date: string; count: number }[][] = [];
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  const cursor = new Date(start);
  while (cursor <= today) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKey(cursor);
      if (cursor.getMonth() !== lastMonth && cursor.getDate() <= 7) {
        monthLabels.push({ label: cursor.toLocaleDateString("en-US", { month: "short" }), colIndex: weeks.length });
        lastMonth = cursor.getMonth();
      }
      week.push({ date: key, count: dayCounts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, monthLabels };
}
export default function AnalyticsPanel({ boardName, boardId }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  // activity-stats / leaderboard removed to reduce load; keep only core analytics
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const analyticsRes = await fetch(`/api/analytics?boardId=${boardId}`);
      if (analyticsRes.ok) {
        setData(await analyticsRes.json());
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
      else if (sortKey === "assignee") diff = (a.assignee ?? "").toLowerCase().localeCompare((b.assignee ?? "").toLowerCase());
      if (diff === 0) diff = a.title.localeCompare(b.title); // stable tie-break
      return sortDir === "asc" ? diff : -diff;
    });
    return list;
  }, [data, filter, sortKey, sortDir]);

  const hasAssignees = useMemo(() => data?.tasks.some((t) => t.assignee) ?? false, [data]);

  if (loading && !data) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading analytics…</div>;
  }
  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted text-sm">
        <p>Failed to load analytics.</p>
        <button
          onClick={fetchData}
          className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-border hover:border-ink/40 hover:text-ink transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { summary, columns, assignees } = data;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-32 md:py-8 no-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div className="pl-14 md:pl-0">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <SummaryCard label="Total tasks" value={String(summary.total)} sub="" />
        <SummaryCard label="Completed" value={String(summary.completed)} sub={summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}%` : "0%"} valueColor="text-green-600" />
        <SummaryCard label="In progress" value={String(summary.inProgress)} sub="" valueColor="text-blue-600" />
        <SummaryCard label="Overdue" value={String(summary.overdue)} sub="" valueColor={summary.overdue > 0 ? "text-red-500" : "text-ink"} />
        <SummaryCard label="Avg cycle time" value={summary.avgCycleTimeMs !== null ? formatDuration(summary.avgCycleTimeMs) : "—"} sub="to complete" />
      </div>

      {/* Contribution Activity — hidden, preserved for future use
      {activityData && (
        <Section title="Contribution Activity">
          <ContributionHeatmap data={activityData.dailyScores.map(d => ({ date: d.date, value: d.score }))} />
          <div className="bg-card-bg rounded-xl border border-border p-5 mt-4">
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Completions over time</h4>
              <p className="text-[11px] text-muted">Weekly volume — last 12 weeks</p>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DED8" opacity={0.1} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#78716C", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78716C", fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1C1917", borderRadius: "12px", border: "1px solid #2D2A27", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
                    labelStyle={{ fontWeight: "bold", color: "#FDFCFA", marginBottom: "4px" }}
                    itemStyle={{ color: "#3B82F6" }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>
      )}
      */}

      {/* Phase Health */}
      <Section title="Workflow Overview">
        {(() => {
          const maxTasks = Math.max(1, ...columns.filter((c) => !c.isDone).map((c) => c.currentTaskCount));
          const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
          return (
            <div className="flex flex-col lg:flex-row items-stretch gap-0 w-full">
              {columns.map((col, i) => (
                <div key={col.id} className="flex flex-col lg:flex-row items-stretch min-w-0" style={{ flex: "1 1 0" }}>
                  {/* Column card */}
                  <div className={`w-full rounded-xl border p-4 flex flex-col gap-3 h-full ${
                    col.isBottleneck
                      ? "border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                      : col.isDone
                      ? "border-green-300 dark:border-green-800 bg-green-100/60 dark:bg-green-950/20"
                      : "border-border bg-card-bg"
                  }`}>
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-ink">{col.label}</span>
                        {col.isBottleneck && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                            ⚠ Bottleneck
                          </span>
                        )}
                        {col.isDone && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                            ✓ Done
                          </span>
                        )}
                      </div>
                      {/* Task count + load bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xl font-bold text-ink leading-none">{col.currentTaskCount}</span>
                        <span className="text-xs text-muted leading-none mt-1">task{col.currentTaskCount !== 1 ? "s" : ""}</span>
                      </div>
                      {!col.isDone && (
                        <div className="mt-1.5 h-1.5 w-full bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${col.isBottleneck ? "bg-orange-400" : "bg-blue-400"}`}
                            style={{ width: `${Math.max(4, Math.round((col.currentTaskCount / maxTasks) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex flex-col gap-1.5 text-xs">
                      {col.isDone ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Completed</span>
                            <span className="font-semibold text-green-700 dark:text-green-300">{summary.completed} / {summary.total}</span>
                          </div>
                          <div className="h-1.5 w-full bg-green-200 dark:bg-green-900/40 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 dark:bg-green-500 rounded-full" style={{ width: `${completionPct}%` }} />
                          </div>
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-muted">{completionPct}% done</span>
                          </div>
                          {summary.avgCycleTimeMs !== null && (
                            <div className="flex justify-between items-center pt-1 border-t border-green-200 dark:border-green-900/40">
                              <span className="text-muted">Avg cycle time</span>
                              <span className="font-medium text-ink">{formatDuration(summary.avgCycleTimeMs)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {(() => {
                            const stagnant = data.tasks.filter(
                              (t) => t.columnId === col.id && t.currentPhaseMs > 3 * MS_DAY
                            ).length;
                            return (
                              <div className="flex justify-between items-center">
                                <span className="text-muted">3+ days in phase</span>
                                <span className={`font-medium ${stagnant > 0 ? "text-yellow-600" : "text-ink"}`}>
                                  {stagnant > 0 ? `${stagnant} task${stagnant !== 1 ? "s" : ""}` : "None"}
                                </span>
                              </div>
                            );
                          })()}
                          <div className="flex justify-between items-center">
                            <span className="text-muted">Avg stay</span>
                            <span className={`font-medium ${col.isBottleneck ? "text-orange-500" : "text-ink"}`}>
                              {col.avgPhaseTimeMs !== null ? formatDuration(col.avgPhaseTimeMs) : "—"}
                            </span>
                          </div>
                          {col.longestStagnantTitle && (
                            <div className="pt-1 border-t border-border">
                              <p className="text-muted mb-0.5">Longest in phase</p>
                              <p
                                className={`font-medium truncate ${(col.longestStagnantMs ?? 0) > 3 * MS_DAY ? "text-red-500" : "text-ink"}`}
                                title={col.longestStagnantTitle}
                              >
                                {col.longestStagnantTitle}
                              </p>
                              <p className="text-muted">{formatDuration(col.longestStagnantMs!)}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow between columns */}
                  {i < columns.length - 1 && (
                    <div className="flex items-center justify-center py-2 lg:py-0 px-0 lg:px-2 flex-shrink-0">
                      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" className="text-muted/40 rotate-90 lg:rotate-0">
                        <path d="M0 8 H16 M10 2 L18 8 L10 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </Section>

      <Section title="Project Health">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HealthMetric
            label="3+ days in phase"
            value={`${summary.stagnantCount} task${summary.stagnantCount !== 1 ? "s" : ""}`}
            sub={`${Math.round(summary.stagnantRate * 100)}% of active — in phase 3+ days`}
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
            <span className="text-green-500 dark:text-green-400 text-lg">✓</span>
            <span className="text-sm text-muted">No suspicious activity detected across completed tasks.</span>
          </div>
        ) : (
          <>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-3 flex items-start gap-3">
              <span className="text-red-500 dark:text-red-400 mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {summary.suspiciousTasks.length} completed task{summary.suspiciousTasks.length !== 1 ? "s" : ""} flagged for review
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                  Flags indicate tasks completed suspiciously fast, that bypassed intermediate columns, or moved by someone other than the assignee.
                </p>
              </div>
            </div>
            <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
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
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                              Speed-run
                            </span>
                          )}
                          {t.isColumnSkip && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                              Skipped column
                            </span>
                          )}
                          {t.isMovedByOther && (
                            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                              Moved by non-assignee
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <SortTh label="Assignee" k="assignee" sortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
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
        </div>
      </Section>
      )}

      {/* Completion Leaderboard removed to simplify analytics and reduce load */}

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
      {active ? <span className="ml-1 opacity-60">{dir === "asc" ? "\u2191" : "\u2193"}</span> : <span className="ml-1 opacity-20">{"\u2195"}</span>}
    </th>
  );
}

function ContributionHeatmap({ data }: { data: { date: string; value: number }[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const { weeks, monthLabels } = buildHeatmapGrid(data);
  const CELL = 11;
  const GAP = 2;
  const STEP = CELL + GAP;

  return (
    <div className="bg-card-bg rounded-xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Task Completion Velocity</h4>
          <p className="text-[11px] text-muted">Daily completions — last 52 weeks</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <span>Less</span>
          {[0, 1, 3, 6, 10].map((v) => (
            <div key={v} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: heatColorBoard(v) }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div style={{ position: "relative", paddingTop: 18, paddingLeft: 26, width: weeks.length * STEP + 28 }}>
          {monthLabels.map((m) => (
            <span key={m.label + m.colIndex} style={{ position: "absolute", top: 0, left: 26 + m.colIndex * STEP, fontSize: 10, color: "var(--color-muted, #78716C)", whiteSpace: "nowrap" }}>
              {m.label}
            </span>
          ))}
          {["Mon", "Wed", "Fri"].map((label, i) => (
            <span key={label} style={{ position: "absolute", left: 0, top: 18 + (i === 0 ? STEP : i === 1 ? STEP * 3 : STEP * 5), fontSize: 10, color: "var(--color-muted, #78716C)", lineHeight: 1 }}>
              {label}
            </span>
          ))}
          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {week.map((day) => (
                  <div
                    key={day.date}
                    style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: heatColorBoard(day.count), cursor: day.count > 0 ? "pointer" : "default" }}
                    onMouseEnter={(e) => {
                      const unit = day.count === 1 ? "task completed" : "tasks completed";
                      setTooltip({ text: `${day.count} ${unit} on ${day.date}`, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
          {tooltip && (
            <div style={{ position: "fixed", left: tooltip.x, top: tooltip.y - 12, transform: "translateX(-50%) translateY(-100%)", backgroundColor: "#1C1917", color: "#FDFCFA", padding: "4px 10px", borderRadius: 8, fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none", border: "1px solid #2D2A27", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 9999 }}>
              {tooltip.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

