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

export default function AdminPanel() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, healthRes] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/health")
      ]);
      
      if (reportsRes.ok) setReports(await reportsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
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
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-16 pb-32 md:py-8 no-scrollbar">
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
              </div>
            </div>
          )}
        </div>
      </div>

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
              <ConfirmModal
                isOpen={confirmDeleteReportId !== null}
                title="Delete report?"
                message="Are you sure you want to permanently delete this report?"
                confirmLabel="Delete"
                danger={true}
                onClose={() => setConfirmDeleteReportId(null)}
                onConfirm={performDeleteReport}
              />
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
    </div>
  );
}
