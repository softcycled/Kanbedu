"use client";

import { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";

interface BugReport {
  id: string;
  title: string;
  description: string;
  browserInfo: string | null;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface HealthData {
  status: string;
  database: string;
  latency: string;
}

interface EmailStats {
  available: boolean;
  sent?: number;
  limit?: number;
  remaining?: number;
  warning?: boolean;
}

interface UsageStats {
  windowDays: number;
  deviceSplit: { desktop: number; mobile: number; unknown: number };
  topEvents: { event: string; count: number }[];
  topPanels: { panel: string; count: number }[];
  activeUsers: { last24h: number; last7d: number; last30d: number };
}

const EVENT_LABELS: Record<string, string> = {
  panel_view: "Panel viewed",
  board_view: "Board opened",
  task_created: "Task created",
  task_moved: "Task moved",
  task_completed: "Task completed",
};

export default function AdminPanel() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, healthRes, emailRes, usageRes] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/health"),
        fetch("/api/admin/email-stats"),
        fetch("/api/admin/usage"),
      ]);

      if (reportsRes.ok) setReports(await reportsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (emailRes.ok) setEmailStats(await emailRes.json());
      if (usageRes.ok) setUsage(await usageRes.json());
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const deleteReport = async (id: string) => {
    // open confirm modal
    setConfirmDeleteReportId(id);
  };

  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState<string | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);

  const performDeleteReport = async () => {
    if (!confirmDeleteReportId) return;
    setIsDeletingReport(true);
    try {
      const res = await fetch(`/api/admin/reports/${confirmDeleteReportId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== confirmDeleteReportId));
      }
    } catch (error) {
      console.error("Failed to delete report:", error);
    } finally {
      setIsDeletingReport(false);
      setConfirmDeleteReportId(null);
    }
  };

  const filteredReports = reports.filter(r => filter === "all" || r.status === filter);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-8 md:py-8 no-scrollbar">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-ink">Admin Dashboard</h2>
          <p className="text-sm text-muted mt-0.5">Manage user bug reports and feedback</p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
          <div className="flex bg-column-bg/50 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full no-scrollbar">
            {["all", "open", "in-progress", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filter === s 
                    ? "bg-card-bg text-ink shadow-sm border border-border/60" 
                    : "text-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          
          {health && (
            <div className="flex items-center gap-4 px-4 py-2 bg-card-bg border border-border/60 rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full motion-safe:animate-pulse ${health.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">System Health</span>
              </div>
              <div className="h-3 w-[1px] bg-border/60" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-start">
                  <span className="text-[9px] text-muted leading-none mb-1 uppercase font-bold">DB Latency</span>
                  <span className="text-xs font-mono font-bold text-ink">{health.latency}</span>
                </div>
                {emailStats !== null && (
                  <>
                    <div className="h-3 w-[1px] bg-border/60" />
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] text-muted leading-none mb-1 uppercase font-bold">Email today</span>
                      {emailStats.available && emailStats.sent !== undefined && emailStats.limit !== undefined ? (
                        <span className={`text-xs font-mono font-bold ${emailStats.warning ? "text-amber-500" : "text-ink"}`}>
                          {emailStats.sent} / {emailStats.limit}
                          {emailStats.warning && " !"}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted">N/A</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {usage && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-ink">Usage <span className="font-normal text-muted">— last {usage.windowDays} days</span></h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active users */}
            <div className="bg-card-bg border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Active users</p>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-2xl font-bold text-ink">{usage.activeUsers.last24h}</p>
                  <p className="text-[10px] text-muted">24h</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{usage.activeUsers.last7d}</p>
                  <p className="text-[10px] text-muted">7d</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink">{usage.activeUsers.last30d}</p>
                  <p className="text-[10px] text-muted">30d</p>
                </div>
              </div>
            </div>

            {/* Device split */}
            <div className="bg-card-bg border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Device split</p>
              {(() => {
                const total = usage.deviceSplit.desktop + usage.deviceSplit.mobile + usage.deviceSplit.unknown;
                if (total === 0) return <p className="text-xs text-muted">No data yet.</p>;
                const pct = (n: number) => Math.round((n / total) * 100);
                return (
                  <div className="space-y-2">
                    {([
                      ["Desktop", usage.deviceSplit.desktop],
                      ["Mobile", usage.deviceSplit.mobile],
                    ] as const).map(([label, n]) => (
                      <div key={label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-ink/80">{label}</span>
                          <span className="text-muted font-mono">{pct(n)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-column-bg overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct(n)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Top panels */}
            <div className="bg-card-bg border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Most-viewed panels</p>
              {usage.topPanels.length === 0 ? (
                <p className="text-xs text-muted">No data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {usage.topPanels.slice(0, 5).map((p) => (
                    <li key={p.panel} className="flex items-center justify-between text-xs">
                      <span className="text-ink/80 capitalize">{p.panel}</span>
                      <span className="text-muted font-mono">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {usage.topEvents.length > 0 && (
            <div className="bg-card-bg border border-border/60 rounded-2xl p-5 shadow-sm mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Top actions</p>
              <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                {usage.topEvents.map((e) => (
                  <li key={e.event} className="flex items-center justify-between text-xs">
                    <span className="text-ink/80">{EVENT_LABELS[e.event] ?? e.event}</span>
                    <span className="text-muted font-mono">{e.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-border/40 rounded-2xl">
            <p className="text-muted text-sm">No bug reports found.</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="bg-card-bg border border-border/60 rounded-2xl p-5 shadow-sm space-y-4 hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink">{report.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-ink/80">{report.user.name}</span>
                      <span>({report.user.email})</span>
                    </span>
                    <span>•</span>
                    <span>{new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {new Date(report.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={report.status}
                    onChange={(e) => updateStatus(report.id, e.target.value)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border outline-none transition-all cursor-pointer ${
                      report.status === "open" ? "bg-red-500/10 border-red-500/20 text-red-600" :
                      report.status === "in-progress" ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                      "bg-green-500/10 border-green-500/20 text-green-600"
                    }`}
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="p-1.5 text-muted hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                    title="Delete report"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-column-bg/30 p-4 rounded-xl border border-border/40">
                <p className="text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">{report.description}</p>
              </div>

              {report.browserInfo && (
                <div className="flex items-center gap-2 text-[10px] text-muted font-mono bg-ink/5 px-3 py-1.5 rounded-lg border border-border/40">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span className="truncate">{report.browserInfo}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDeleteReportId !== null}
        title="Delete report?"
        message="Are you sure you want to permanently delete this report?"
        confirmLabel="Delete"
        danger={true}
        onClose={() => setConfirmDeleteReportId(null)}
        onConfirm={performDeleteReport}
      />
    </div>
  );
}
