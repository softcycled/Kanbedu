"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDeadlineLabel } from "@/lib/utils";
import { getPriorityConfig } from "@/lib/priority";
import { resolveColumnPalette } from "@/lib/columnPalette";
import PriorityIcon from "./PriorityIcon";
import MarkdownText from "./MarkdownText";
import FilterBar from "./FilterBar";

interface PublicTag {
  id: string;
  name: string;
  color: string;
}

interface PublicTask {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: string;
  column: string;
  order: number;
  tags: PublicTag[];
}

interface PublicColumn {
  id: string;
  label: string;
  order: number;
  isDone: boolean;
  color: string | null;
}

interface PublicBoardData {
  boardName: string;
  columns: PublicColumn[];
  tasks: PublicTask[];
}

const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Med", high: "High", urgent: "URGENT" };

function PublicTaskCard({ task, onClick }: { task: PublicTask; onClick: () => void }) {
  const deadlineInfo = formatDeadlineLabel(task.deadline, null);
  const p = task.priority ?? "medium";

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-label={`View task: ${task.title}`}
      className="bg-card-bg rounded-2xl px-4 py-4 shadow-card hover:shadow-card-hover cursor-pointer select-none border border-transparent hover:border-border transition-colors"
    >
      <p className="text-sm font-medium text-ink leading-snug tracking-[-0.01em] break-words">{task.title}</p>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2">
          {task.tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none text-ink border border-border/60">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${getPriorityConfig(p).text}`}>
          <PriorityIcon priority={p} className="w-3 h-3" />
          {PRIORITY_LABEL[p]}
        </span>
        {deadlineInfo.severity !== "none" && (
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${
            deadlineInfo.severity === "overdue" ? "text-red-600 dark:text-red-400" :
            deadlineInfo.severity === "due-soon" ? "text-orange-500 dark:text-orange-400" : "text-muted"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${deadlineInfo.severity === "overdue" ? "bg-red-500" : deadlineInfo.severity === "due-soon" ? "bg-orange-500" : "bg-muted/30"}`} />
            {deadlineInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}

function PublicTaskDetail({ task, columnLabel, onClose }: { task: PublicTask; columnLabel: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const deadlineInfo = formatDeadlineLabel(task.deadline, null);
  const p = task.priority ?? "medium";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px] motion-safe:animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card-bg border border-border rounded-2xl shadow-modal p-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-ink break-words">{task.title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex-shrink-0 text-muted hover:text-ink transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <span className="px-2 py-1 rounded-full bg-ink/5 text-muted font-medium">{columnLabel}</span>
          <span className={`inline-flex items-center gap-1 font-semibold ${getPriorityConfig(p).text}`}>
            <PriorityIcon priority={p} className="w-3 h-3" />
            {PRIORITY_LABEL[p]}
          </span>
          {deadlineInfo.severity !== "none" && (
            <span className={`inline-flex items-center gap-1.5 font-medium ${
              deadlineInfo.severity === "overdue" ? "text-red-600 dark:text-red-400" :
              deadlineInfo.severity === "due-soon" ? "text-orange-500 dark:text-orange-400" : "text-muted"
            }`}>
              {deadlineInfo.label}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border/60 text-ink">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>

        {task.description ? (
          <MarkdownText text={task.description} className="text-sm text-ink/80 leading-relaxed" />
        ) : (
          <p className="text-sm text-muted italic">No description.</p>
        )}
      </div>
    </div>
  );
}

export default function PublicBoardView({ token }: { token: string }) {
  const [data, setData] = useState<PublicBoardData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedTask, setSelectedTask] = useState<PublicTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/public/boards/${token}`)
      .then(async (res) => {
        if (!res.ok) { setStatus("error"); return; }
        const json = await res.json();
        setData(json);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  // Done column pinned last, matching the rule every other board view follows
  // for stable, correct palette resolution.
  const sortedColumns = useMemo(() => {
    if (!data) return [];
    const nonDone = data.columns.filter((c) => !c.isDone).sort((a, b) => a.order - b.order);
    const done = data.columns.filter((c) => c.isDone);
    return [...nonDone, ...done];
  }, [data]);

  const allTags = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, PublicTag>();
    for (const task of data.tasks) {
      for (const tag of task.tags) {
        if (!map.has(tag.id)) map.set(tag.id, tag);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter((task) => {
      if (searchQuery) {
        const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [task.title, ...task.tags.map((t) => t.name)].join(" ").toLowerCase();
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      if (selectedTags.length > 0) {
        const taskTagIds = task.tags.map((t) => t.id);
        if (!selectedTags.some((id) => taskTagIds.includes(id))) return false;
      }
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(task.priority)) return false;
      return true;
    });
  }, [data, searchQuery, selectedTags, selectedPriorities]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, PublicTask[]>();
    for (const task of filteredTasks) {
      const list = map.get(task.column) ?? [];
      list.push(task);
      map.set(task.column, list);
    }
    return map;
  }, [filteredTasks]);

  if (status === "loading") {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">Loading board...</div>;
  }
  if (status === "error" || !data) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-medium text-ink">This board isn&apos;t available for public viewing.</p>
        <p className="text-xs text-muted mt-1">The link may have been revoked, or public viewing was turned off.</p>
      </div>
    );
  }

  const selectedColumnLabel = selectedTask
    ? sortedColumns.find((c) => c.id === selectedTask.column)?.label ?? ""
    : "";

  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-40 bg-accent/10 border-b border-accent/20 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center gap-2 text-xs font-medium text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          You&apos;re viewing in preview mode. This board can&apos;t be edited.
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex flex-wrap items-center gap-4 py-5 border-b border-border/60">
          <h1 className="text-xl font-bold tracking-tight text-ink shrink-0">{data.boardName}</h1>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <FilterBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedAssignees={[]}
              setSelectedAssignees={() => {}}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
              selectedPriorities={selectedPriorities}
              setSelectedPriorities={setSelectedPriorities}
              members={[]}
              tags={allTags}
              totalTasks={data.tasks.length}
              filteredTasksCount={filteredTasks.length}
              hideAssignee
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-4 pt-6">
          <div className="flex gap-4" style={{ minWidth: sortedColumns.length * 280 }}>
            {sortedColumns.map((col, index) => {
              const palette = resolveColumnPalette(col.color, index);
              const tasks = (tasksByColumn.get(col.id) ?? []).sort((a, b) => a.order - b.order);
              return (
                <div key={col.id} className="flex-1 flex flex-col min-w-[260px]">
                  <div className={`flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg border ${palette.bg} ${palette.border}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${palette.dot}`} />
                    <h2 className={`text-sm font-bold tracking-wide ${palette.text} flex-1`}>{col.label}</h2>
                    <span className="text-xs text-muted font-mono bg-ink/5 rounded-md px-1.5 py-0.5">{tasks.length}</span>
                  </div>
                  <div className="flex-1 rounded-xl bg-column-bg p-2 min-h-[120px]">
                    <div className="flex flex-col gap-3">
                      {tasks.map((task) => (
                        <PublicTaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedTask && (
        <PublicTaskDetail task={selectedTask} columnLabel={selectedColumnLabel} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
