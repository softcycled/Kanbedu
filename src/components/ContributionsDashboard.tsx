"use client";

import { useState, useEffect } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface BoardContributor {
  user: {
    id: string;
    name: string;
    color: string;
  };
  completedCount: number;
  avgCycleTimeMs: number | null;
  suspiciousCount: number;
}

interface Props {
  boardId: string;
  boardName: string;
}

// ── Helpers ──────────────────────────────────────────────────

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

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1m";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  const days = ms / 86_400_000;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
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
  data.forEach((d) => (dayCounts[d.date] = d.value));

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
        monthLabels.push({
          label: cursor.toLocaleDateString("en-US", { month: "short" }),
          colIndex: weeks.length,
        });
        lastMonth = cursor.getMonth();
      }
      week.push({ date: key, count: dayCounts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

// ── Components ───────────────────────────────────────────────

function ContributionHeatmap({ 
  data, 
  label 
}: { 
  data: { date: string; value: number }[], 
  label: string 
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const { weeks, monthLabels } = buildHeatmapGrid(data);

  const CELL = 12;
  const GAP = 2;
  const STEP = CELL + GAP;

  return (
    <div className="bg-paper rounded-2xl border border-border/60 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted/80">{label}</h3>
          <p className="text-xs text-muted">Daily completions — last 52 weeks</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <span>Less</span>
          {[0, 1, 3, 6, 10].map((v) => (
            <div
              key={v}
              style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: heatColorBoard(v) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <div style={{ position: "relative", paddingTop: 20, paddingLeft: 28, width: weeks.length * STEP + 30 }}>
          {monthLabels.map((m) => (
            <span
              key={m.label + m.colIndex}
              style={{
                position: "absolute",
                top: 0,
                left: 28 + m.colIndex * STEP,
                fontSize: 10,
                color: "var(--color-muted, #78716C)",
                whiteSpace: "nowrap",
              }}
            >
              {m.label}
            </span>
          ))}

          {["Mon", "Wed", "Fri"].map((label, i) => (
            <span
              key={label}
              style={{
                position: "absolute",
                left: 0,
                top: 20 + (i === 0 ? STEP : i === 1 ? STEP * 3 : STEP * 5),
                fontSize: 10,
                color: "var(--color-muted, #78716C)",
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}

          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {week.map((day, di) => (
                  <div
                    key={day.date}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      backgroundColor: heatColorBoard(day.count),
                      cursor: day.count > 0 ? "pointer" : "default",
                      transition: "opacity 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      const pluralUnit = day.count === 1 ? "task completed" : "tasks completed";
                      setTooltip({
                        text: `${day.count} ${pluralUnit} on ${day.date}`,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>

          {tooltip && (
            <div
              style={{
                position: "fixed",
                left: tooltip.x,
                top: tooltip.y - 12,
                transform: "translateX(-50%) translateY(-100%)",
                backgroundColor: "#1C1917",
                color: "#FDFCFA",
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 11,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                border: "1px solid #2D2A27",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                zIndex: 9999,
              }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContributionsDashboard({ boardId, boardName }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);

  const [boardStats, setBoardStats] = useState<{
    dailyScores: { date: string; score: number }[];
    userLeaderboard: BoardContributor[];
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/activity-stats?_t=${Date.now()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch activity");
      setBoardStats(data);

      const weekBuckets: Record<number, number> = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        weekBuckets[getWeekStart(d)] = 0;
      }
      (data.dailyScores as { date: string; score: number }[]).forEach((d) => {
        const ws = getWeekStart(new Date(d.date));
        if (weekBuckets[ws] !== undefined) weekBuckets[ws] += d.score;
      });
      setChartData(Object.entries(weekBuckets).map(([ts, val]) => ({
        date: formatWeekLabel(Number(ts)),
        value: val,
      })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [boardId]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar bg-paper">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">Contributions</h1>
          <p className="text-muted text-sm">Tracking project momentum for {boardName}</p>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-ink/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted text-sm">Fetching insights...</p>
          </div>
        </div>
      ) : error ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            <div className="w-12 h-12 bg-muted/5 text-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h3 className="text-ink font-semibold mb-2">No activity found</h3>
            <p className="text-muted text-sm mb-6">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <ContributionHeatmap 
            label="Task Completion Velocity"
            data={boardStats!.dailyScores.map(d => ({ date: d.date, value: d.score }))}
          />

          <div className="bg-paper rounded-2xl border border-border/60 p-6 shadow-sm">
            <div className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted/80">Completions over time</h3>
              <p className="text-xs text-muted">Weekly volume — last 12 weeks</p>
            </div>

            <div className="h-48 w-full">
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

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted/80 mb-6 flex items-center gap-2">
              Team Leaderboard
              <span className="h-px flex-1 bg-border/40" />
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {boardStats?.userLeaderboard.map((c, i) => (
                <ContributorCardBoard key={c.user.id} contributor={c} rank={i + 1} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContributorCardBoard({ contributor, rank }: { contributor: BoardContributor; rank: number }) {
  return (
    <div className="bg-paper rounded-2xl border border-border/60 p-5 shadow-sm hover:border-accent/30 transition-all group relative overflow-hidden">
      {contributor.suspiciousCount > 0 && (
        <div 
          className="absolute top-0 right-0 p-2"
          title={`${contributor.suspiciousCount} tasks flagged for speed-running or skipping columns.`}
        >
          <div className="bg-red-500 text-white p-1 rounded-bl-xl shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm group-hover:scale-105 transition-transform"
          style={{ backgroundColor: contributor.user.color }}
        >
          {contributor.user.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-ink truncate">{contributor.user.name}</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-bold">#{rank}</span>
          </div>
          <p className="text-xs text-muted">Member</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/40">
        <div>
          <span className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Tasks Completed</span>
          <span className="text-lg font-bold text-ink">{contributor.completedCount}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Efficiency</span>
          <span className={`text-lg font-bold ${contributor.avgCycleTimeMs && contributor.avgCycleTimeMs < 3600000 ? "text-orange-500" : "text-ink"}`}>
            {contributor.avgCycleTimeMs ? formatDuration(contributor.avgCycleTimeMs) : "—"}
          </span>
        </div>
      </div>
      
      {contributor.suspiciousCount > 0 && (
        <div className="mt-3 px-2 py-1 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Integrity Alert: {contributor.suspiciousCount} Flag{contributor.suspiciousCount !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
