"use client";

import { useMemo } from "react";
import { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
  boardName: string;
}

interface StatCardProps {
  label: string;
  value: number;
  total?: number;
  color: string;
}

function StatCard({ label, value, total, color }: StatCardProps) {
  return (
    <div className="bg-card-bg rounded-xl border border-border p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {total !== undefined && (
        <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
            style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
          />
        </div>
      )}
      <div className="mt-2 text-sm text-muted">{label}</div>
    </div>
  );
}

export default function AnalyticsPanel({ tasks, boardName }: Props) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completedAt).length;
    const inProgress = tasks.filter((t) => !t.completedAt).length;
    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && !t.completedAt
    ).length;

    const byPriority = {
      urgent: tasks.filter((t) => t.priority === "urgent").length,
      high: tasks.filter((t) => t.priority === "high").length,
      medium: tasks.filter((t) => t.priority === "medium").length,
      low: tasks.filter((t) => t.priority === "low").length,
    };

    return { total, completed, inProgress, overdue, byPriority };
  }, [tasks]);

  return (
    <div className="flex-1 px-10 py-8 overflow-y-auto">
      <h2 className="text-xl font-bold text-ink mb-1">Analytics</h2>
      <p className="text-sm text-muted mb-8">{boardName}</p>

      <div className="grid grid-cols-2 gap-4 max-w-lg mb-8">
        <StatCard label="Total tasks" value={stats.total} color="text-ink" />
        <StatCard
          label="Completed"
          value={stats.completed}
          total={stats.total}
          color="text-green-600"
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          total={stats.total}
          color="text-blue-600"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          total={stats.total}
          color="text-red-500"
        />
      </div>

      <div className="max-w-lg">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          By Priority
        </h3>
        <div className="bg-card-bg rounded-xl border border-border divide-y divide-border">
          {[
            { key: "urgent", label: "Urgent", color: "bg-red-500" },
            { key: "high", label: "High", color: "bg-orange-400" },
            { key: "medium", label: "Medium", color: "bg-yellow-400" },
            { key: "low", label: "Low", color: "bg-green-400" },
          ].map(({ key, label, color }) => {
            const count = stats.byPriority[key as keyof typeof stats.byPriority];
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                <span className="text-sm text-ink flex-1">{label}</span>
                <span className="text-sm font-medium text-ink">{count}</span>
                <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{
                      width:
                        stats.total > 0
                          ? `${(count / stats.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
