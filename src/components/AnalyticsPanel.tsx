"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Cell, AreaChart, Area,
} from "recharts";
import Skeleton from "./Skeleton";
import { useTheme } from "./ThemeProvider";

interface Props {
  boardName: string;
  boardId: string;
  onClose?: () => void;
}

// ── Types ─────────────────────────────────────────────────────

interface PhaseStats {
  id: string;
  label: string;
  isDone: boolean;
  isFirst: boolean;
  currentTaskCount: number;
  throughput: number;
  avgPhaseTimeMs: number | null;
  longestStagnantMs: number | null;
  longestStagnantTitle: string | null;
  isBottleneck: boolean;
}

// Both pre-aggregated server-side (see src/app/api/analytics/route.ts) so the
// response stays a fixed small size regardless of how many tasks the board
// has, instead of shipping one JSON object per task just to bucket them
// client-side.
interface WeeklyCompletionBucket {
  label: string;
  count: number;
  isCurrent: boolean;
}

interface PriorityMixRow {
  priority: "urgent" | "high" | "medium" | "low";
  open: number;
  done: number;
  total: number;
}

interface AnalyticsData {
  columns: PhaseStats[];
  weeklyCompletions: WeeklyCompletionBucket[];
  priorityMix: PriorityMixRow[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    avgCycleTimeMs: number | null;
    stagnantCount: number;
    stagnantRate: number;
    deadlineAdherence: { onTime: number; total: number } | null;
    historyTruncated: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────

const MS_DAY = 86_400_000;

// Status colors are theme-invariant, matching the dot/badge colors already
// used for bottleneck + done states elsewhere in the app.
const STATUS_GOOD = "#22C55E";
const STATUS_WARN = "#F97316";
// Title-case even for urgent -- the shared PRIORITY_CONFIG.urgent.label is
// "URGENT" (all-caps, deliberate everywhere else it's used, e.g. task cards),
// but sitting directly next to "High/Med/Low" on a compact chart axis it reads
// as shouty. This is a display-only override scoped to this chart.
const PRIORITY_AXIS_LABEL: Record<string, string> = { urgent: "Urgent", high: "High", medium: "Med", low: "Low" };

// Shared legend for the two phase charts -- both color bars the same way
// (normal / bottleneck / done), so they use one legend definition.
const PHASE_LEGEND = (accentHex: string) => [
  { label: "Normal", color: accentHex },
  { label: "Bottleneck", color: STATUS_WARN },
  { label: "Done", color: STATUS_GOOD },
];

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1m";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < MS_DAY) return `${Math.floor(ms / 3_600_000)}h`;
  const days = ms / MS_DAY;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

function AnalyticsPanel({ boardName, boardId, onClose }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

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
  // Bars/meters paint at 0 on the first frame, then transition to real values
  // once data has actually loaded -- not on a fixed timeout.
  useEffect(() => {
    if (loading || !data) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [loading, data]);

  // Theme-reactive chart chrome. These are resolved to concrete hex (not CSS
  // vars) because Cell/Area fills are SVG presentation attributes -- safer to
  // compute the value once than rely on var() resolution inside recharts' SVG.
  const accentHex = resolvedTheme === "dark" ? "#3B82F6" : "#2563EB";
  const inkHex = resolvedTheme === "dark" ? "#F2EFE9" : "#1C1917";
  const mutedHex = resolvedTheme === "dark" ? "#A8A29E" : "#78716C";
  const borderHex = resolvedTheme === "dark" ? "#464340" : "#E2DED8";
  const cardBgHex = resolvedTheme === "dark" ? "#302D2A" : "#FDFCFA";

  const phaseTaskData = useMemo(() => {
    if (!data) return [];
    return data.columns.map((c) => ({
      id: c.id, name: c.label, tasks: c.currentTaskCount, isDone: c.isDone, isBottleneck: c.isBottleneck,
      throughput: c.throughput, longestStagnantMs: c.longestStagnantMs, longestStagnantTitle: c.longestStagnantTitle,
    }));
  }, [data]);

  const phaseTimeData = useMemo(() => {
    if (!data) return [];
    return data.columns
      .filter((c) => c.avgPhaseTimeMs !== null)
      .map((c) => ({ id: c.id, name: c.label, days: (c.avgPhaseTimeMs ?? 0) / MS_DAY, raw: c.avgPhaseTimeMs ?? 0, isDone: c.isDone, isBottleneck: c.isBottleneck }));
  }, [data]);

  // Open vs done per priority, not just a raw count -- "6 urgent tasks" is
  // trivia, "6 urgent, 4 still open" is something you can act on. Both
  // pieces are pre-aggregated server-side now -- this just adds the
  // display-only title-cased label.
  const priorityMix = useMemo(() => {
    if (!data) return [];
    return data.priorityMix.map((p) => ({ ...p, label: PRIORITY_AXIS_LABEL[p.priority] ?? p.priority }));
  }, [data]);

  const weeklyCompletions = data?.weeklyCompletions ?? [];

  const bottleneckPhase = useMemo(() => phaseTaskData.find((c) => c.isBottleneck) ?? null, [phaseTaskData]);

  // Longest-waiting active task across every middle column -- the one thing
  // on this board most worth someone's attention right now. The intake column
  // (To Do / Backlog) is excluded alongside Done: cards sit there by design.
  const oldestStagnant = useMemo(() => {
    if (!data) return null;
    let max: { title: string; ms: number } | null = null;
    for (const c of data.columns) {
      if (c.isDone || c.isFirst || c.longestStagnantMs == null || !c.longestStagnantTitle) continue;
      if (!max || c.longestStagnantMs > max.ms) max = { title: c.longestStagnantTitle, ms: c.longestStagnantMs };
    }
    return max;
  }, [data]);

  // Recharts treats a new object *reference* passed to `tick`/`cursor`/`label`
  // as a reason to reset animation/label state, not just a value diff. The
  // board polls every 3s (useRealtime's fallback interval) and re-renders this
  // panel's ancestor each time, which was recreating these as fresh object
  // literals every render and made the bar-tip value labels flicker on and
  // off in sync with the poll. Memoized on the hex strings so the reference
  // only changes when the theme actually changes.
  const tickStyle = useMemo(() => ({ fill: mutedHex, fontSize: 11 }), [mutedHex]);
  const barCursor = useMemo(() => ({ fill: accentHex, fillOpacity: 0.06 }), [accentHex]);
  const taskCountLabel = useMemo(() => ({ position: "top" as const, style: { fill: inkHex, fontSize: 12, fontWeight: 600 } }), [inkHex]);
  const phaseTimeLabel = useMemo(() => ({
    position: "right" as const,
    dataKey: "raw",
    formatter: (v: unknown) => formatDuration(Number(v) || 0),
    style: { fill: inkHex, fontSize: 12, fontWeight: 600 },
  }), [inkHex]);
  const areaActiveDot = useMemo(() => ({ r: 6, fill: accentHex, stroke: cardBgHex, strokeWidth: 2 }), [accentHex, cardBgHex]);
  // Only draws a dot on weeks with an actual completion, or the current
  // (still-accumulating) week -- a dot on every empty week added noise to an
  // already-sparse line. Wrapped in useCallback for the same reference-
  // stability reason as the objects above.
  const renderCompletionDot = useCallback((props: { cx?: number; cy?: number; payload?: { isCurrent?: boolean; count?: number; label?: string } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return <></>;
    if (!payload.isCurrent && !payload.count) return <></>;
    return <circle key={payload.label} cx={cx} cy={cy} r={4} fill={accentHex} stroke={cardBgHex} strokeWidth={2} />;
  }, [accentHex, cardBgHex]);

  if (loading && !data) {
    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-8 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-60 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
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

  const { summary } = data;
  const deadlineRate = summary.deadlineAdherence ? summary.deadlineAdherence.onTime / summary.deadlineAdherence.total : null;
  const stagnantColors =
    summary.stagnantRate > 0.3 ? { text: "text-amber-600", bar: "bg-amber-500" } :
    summary.stagnantRate > 0.1 ? { text: "text-yellow-600", bar: "bg-yellow-500" } :
    { text: "text-green-600", bar: "bg-green-500" };
  const deadlineColors =
    deadlineRate === null ? null :
    deadlineRate >= 0.7 ? { text: "text-green-600", bar: "bg-green-500" } : { text: "text-red-500", bar: "bg-red-500" };
  // Below this, five near-empty charts just look broken -- a friendly
  // placeholder reads better than a wall of mostly-blank cards.
  const hasEnoughActivity = summary.total >= 3;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-8 md:py-8 no-scrollbar">
      {onClose && (
        <div className="md:hidden flex items-center gap-3 -mx-4 px-4 pb-4 mb-2 border-b border-border/60">
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors" aria-label="Close analytics">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span className="text-sm font-semibold text-ink">Analytics</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="hidden md:block text-xl font-bold text-ink">Analytics</h2>
          <p className="text-sm text-muted mt-0.5">{boardName}</p>
        </div>
        {lastFetched && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">
              Updated {lastFetched.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <button
              onClick={fetchData}
              aria-label="Refresh analytics"
              className="p-1 rounded-md text-muted hover:text-ink hover:bg-ink/5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <SummaryCard label="Total tasks" value={String(summary.total)} sub="" />
        <SummaryCard label="Completed" value={String(summary.completed)} sub={summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}%` : "0%"} valueColor="text-green-600" />
        <SummaryCard label="In progress" value={String(summary.inProgress)} sub="" valueColor="text-blue-600" />
        <SummaryCard label="Overdue" value={String(summary.overdue)} sub="" valueColor={summary.overdue > 0 ? "text-red-500" : "text-ink"} />
        <SummaryCard label="Avg cycle time" value={summary.avgCycleTimeMs !== null ? formatDuration(summary.avgCycleTimeMs) : "—"} sub="to complete" />
        <SummaryCard
          label="Longest waiting task"
          value={oldestStagnant ? formatDuration(oldestStagnant.ms) : "—"}
          sub={oldestStagnant ? (oldestStagnant.title.length > 24 ? `${oldestStagnant.title.slice(0, 24)}…` : oldestStagnant.title) : "All caught up"}
          valueColor={oldestStagnant && oldestStagnant.ms > 5 * MS_DAY ? "text-amber-600" : "text-ink"}
        />
      </div>

      {!hasEnoughActivity ? (
        <div className="bg-card-bg rounded-xl border border-border p-10 flex flex-col items-center justify-center text-center gap-1.5">
          <p className="text-sm font-medium text-ink">Not enough activity yet</p>
          <p className="text-xs text-muted max-w-xs">Charts will appear here once this board has a few tasks moving through columns.</p>
        </div>
      ) : (
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        {/* Trend */}
        <ChartCard title="Completions over time" subtitle={`Tasks marked done, weekly (last ${weeklyCompletions.length} week${weeklyCompletions.length !== 1 ? "s" : ""})`} height={240}>
          {summary.completed === 0 ? (
            <EmptyChartState text="No completed tasks yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyCompletions} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="completionsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentHex} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={accentHex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={borderHex} strokeOpacity={0.6} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tickStyle} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={tickStyle} width={28} />
                <RechartsTooltip content={<CompletionsTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={accentHex}
                  strokeWidth={2}
                  fill="url(#completionsFill)"
                  isAnimationActive
                  animationDuration={1100}
                  dot={renderCompletionDot}
                  activeDot={areaActiveDot}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Tasks by phase"
            subtitle="Where work sits right now"
            headerExtra={
              <>
                <StatusLegend items={PHASE_LEGEND(accentHex)} />
                {bottleneckPhase && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-600 dark:text-orange-400">
                    <strong>{bottleneckPhase.name}</strong> is the bottleneck: {bottleneckPhase.tasks} task{bottleneckPhase.tasks !== 1 ? "s" : ""} waiting
                  </div>
                )}
              </>
            }
          >
            {phaseTaskData.length === 0 ? (
              <EmptyChartState text="No columns on this board yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseTaskData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={borderHex} strokeOpacity={0.6} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tickStyle} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={false} width={0} />
                  <RechartsTooltip cursor={barCursor} content={<PhaseTaskTooltip />} />
                  <Bar
                    dataKey="tasks"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    isAnimationActive
                    animationDuration={800}
                    label={taskCountLabel}
                  >
                    {phaseTaskData.map((entry) => (
                      <Cell key={entry.id} fill={entry.isDone ? STATUS_GOOD : entry.isBottleneck ? STATUS_WARN : accentHex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Time spent per phase"
            subtitle="Average time a task stays before moving on"
            headerExtra={<StatusLegend items={PHASE_LEGEND(accentHex)} />}
          >
            {summary.historyTruncated && (
              <p className="text-[11px] text-yellow-600 dark:text-yellow-400 mb-2 -mt-1">Some older tasks are estimated -- history is tracked for the last 90 days.</p>
            )}
            {phaseTimeData.length === 0 ? (
              <EmptyChartState text="Not enough movement history yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseTimeData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke={borderHex} strokeOpacity={0.6} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={tickStyle} width={90} />
                  <RechartsTooltip cursor={barCursor} content={<PhaseTimeTooltip />} />
                  <Bar
                    dataKey="days"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    isAnimationActive
                    animationDuration={800}
                    label={phaseTimeLabel}
                  >
                    {phaseTimeData.map((entry) => (
                      <Cell key={entry.id} fill={entry.isDone ? STATUS_GOOD : entry.isBottleneck ? STATUS_WARN : accentHex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Priority + health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Priority mix"
            subtitle="Open vs completed, by priority"
            height={220}
            headerExtra={<StatusLegend items={[{ label: "Open", color: accentHex }, { label: "Done", color: STATUS_GOOD }]} />}
          >
            {priorityMix.every((p) => p.total === 0) ? (
              <EmptyChartState text="No tasks yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityMix} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="26%">
                  <CartesianGrid horizontal={false} stroke={borderHex} strokeOpacity={0.6} />
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={tickStyle} width={56} />
                  <RechartsTooltip cursor={barCursor} content={<PriorityTooltip />} />
                  <Bar dataKey="open" stackId="pm" fill={accentHex} isAnimationActive animationDuration={800} />
                  <Bar dataKey="done" stackId="pm" fill={STATUS_GOOD} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="flex flex-col gap-4">
            <MeterCard
              label="Waiting"
              description="Share of active tasks that haven't moved in 5+ days and have no comments yet."
              displayValue={`${Math.round(summary.stagnantRate * 100)}%`}
              sub={`${summary.stagnantCount} task${summary.stagnantCount !== 1 ? "s" : ""} haven't moved in 5+ days`}
              ratio={summary.stagnantRate}
              textColorClass={stagnantColors.text}
              barColorClass={stagnantColors.bar}
              mounted={mounted}
            />
            {summary.deadlineAdherence && deadlineColors ? (
              <MeterCard
                label="Deadline adherence"
                description="Share of completed tasks finished by their deadline."
                displayValue={`${Math.round(deadlineRate! * 100)}%`}
                sub={`${summary.deadlineAdherence.onTime} of ${summary.deadlineAdherence.total} completed on time`}
                ratio={deadlineRate!}
                textColorClass={deadlineColors.text}
                barColorClass={deadlineColors.bar}
                mounted={mounted}
              />
            ) : (
              <div className="bg-card-bg rounded-xl border border-border p-4 flex-1 flex flex-col justify-center items-center text-center gap-1">
                <span className="text-sm font-medium text-ink">Deadline adherence</span>
                <span className="text-xs text-muted">Share of completed tasks finished by their deadline. No completed tasks with a deadline yet.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="h-8" />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ChartCard({ title, subtitle, headerExtra, height = 260, children }: { title: string; subtitle?: string; headerExtra?: React.ReactNode; height?: number; children: React.ReactNode }) {
  return (
    <div className="bg-card-bg rounded-xl border border-border p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {headerExtra}
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

// Color-only identity is never enough on its own (the bottleneck/done colors
// aren't self-explanatory) -- this makes the meaning of the bar colors
// visible on the chart itself instead of only surfacing on hover.
function StatusLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-3 -mt-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChartState({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-xs text-muted">{text}</div>;
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

function MeterCard({ label, description, displayValue, sub, ratio, textColorClass, barColorClass, mounted }: {
  label: string; description: string; displayValue: string; sub: string; ratio: number;
  textColorClass: string; barColorClass: string; mounted: boolean;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="bg-card-bg rounded-xl border border-border p-4 flex-1 flex flex-col gap-2.5 justify-center">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className={`text-lg font-bold ${textColorClass}`}>{displayValue}</span>
      </div>
      <p className="text-xs text-muted -mt-2">{description}</p>
      <div className="h-2 w-full bg-ink/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColorClass}`}
          style={{ width: mounted ? `${pct}%` : "0%", transition: "width 0.9s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </div>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────

interface TooltipPayload { payload: Record<string, unknown> }

function PhaseTaskTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; tasks: number; throughput: number; isDone: boolean; isBottleneck: boolean; longestStagnantTitle: string | null; longestStagnantMs: number | null };
  return (
    <div className="bg-card-bg border border-border rounded-xl shadow-modal px-3 py-2.5 text-xs max-w-[220px]">
      <p className="font-semibold text-ink mb-1">{d.name}</p>
      <p className="text-muted">{d.tasks} task{d.tasks !== 1 ? "s" : ""} currently here</p>
      {d.throughput > 0 && <p className="text-muted">{d.throughput} have passed through</p>}
      {!d.isDone && d.longestStagnantTitle && (
        <p className="text-muted mt-1 pt-1 border-t border-border">
          Longest waiting: <span className="text-ink">{d.longestStagnantTitle}</span> ({formatDuration(d.longestStagnantMs ?? 0)})
        </p>
      )}
      {d.isBottleneck && <p className="text-orange-500 font-medium mt-1">Bottleneck</p>}
    </div>
  );
}

function PhaseTimeTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; raw: number; isBottleneck: boolean };
  return (
    <div className="bg-card-bg border border-border rounded-xl shadow-modal px-3 py-2.5 text-xs">
      <p className="font-semibold text-ink mb-1">{d.name}</p>
      <p className="text-muted">Avg {formatDuration(d.raw)} per task</p>
      {d.isBottleneck && <p className="text-orange-500 font-medium mt-1">Current bottleneck</p>}
    </div>
  );
}

function PriorityTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { label: string; open: number; done: number; total: number };
  return (
    <div className="bg-card-bg border border-border rounded-xl shadow-modal px-3 py-2.5 text-xs">
      <p className="font-semibold text-ink mb-0.5">{d.label} priority</p>
      <p className="text-muted">{d.total} task{d.total !== 1 ? "s" : ""} total</p>
      <p className="text-muted">{d.open} open, {d.done} done</p>
    </div>
  );
}

function CompletionsTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { label: string; count: number; isCurrent?: boolean };
  return (
    <div className="bg-card-bg border border-border rounded-xl shadow-modal px-3 py-2.5 text-xs">
      <p className="font-semibold text-ink mb-0.5">{d.isCurrent ? "This week (so far)" : `Week of ${d.label}`}</p>
      <p className="text-muted">{d.count} completed</p>
    </div>
  );
}

// Memoized: the board polls every 3s regardless of which panel is open
// (useRealtime's fallback interval, unconditional in BoardContainer), which
// re-renders this component's parent constantly. Recharts replays each bar's
// enter animation (hiding its value label until it "finishes") on every
// re-render of the chart tree, not just when data actually changes -- without
// this memo the value labels flickered on/off every ~3s even though the
// underlying analytics numbers never changed. Requires `onClose` to be a
// stable reference from the caller (see BoardContainer's useCallback).
export default memo(AnalyticsPanel);
