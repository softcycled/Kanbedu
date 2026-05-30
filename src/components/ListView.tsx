"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Task, ColumnData, BoardMemberData } from "@/lib/types";
import { formatDeadlineLabel } from "@/lib/utils";
import { COLUMN_PALETTE } from "@/lib/columnPalette";
import { nameToColor } from "@/lib/avatarColor";

const PRIORITY_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string; text: string }
> = {
  low:    { label: "Low",    dot: "bg-blue-500",   badge: "bg-blue-500/10",   text: "text-blue-500 dark:text-blue-400" },
  medium: { label: "Med",    dot: "bg-yellow-500", badge: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-300" },
  high:   { label: "High",   dot: "bg-orange-500", badge: "bg-orange-500/10", text: "text-orange-500 dark:text-orange-400" },
  urgent: { label: "URGENT", dot: "bg-red-500",    badge: "bg-red-500/10",    text: "text-red-500 dark:text-red-400" },
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// ──  Deadline sorting helper ────────────────────────────────

function getDeadlineSortPriority(deadline: string | Date | null | undefined, completedAt: string | Date | null | undefined): { priority: number; timestamp: number } {
  if (!deadline) return { priority: 4, timestamp: Infinity }; // No deadline = lowest priority
  
  const now = Date.now();
  const deadlineTime = typeof deadline === "string" ? new Date(deadline).getTime() : deadline.getTime();
  const isCompleted = !!completedAt;
  
  if (isCompleted) {
    // Completed tasks have lowest priority (or you could filter them separately)
    return { priority: 4, timestamp: deadlineTime };
  }
  
  const timeUntilDeadline = deadlineTime - now;
  const HOURS_48 = 48 * 60 * 60 * 1000;
  
  if (timeUntilDeadline < 0) {
    // Overdue - highest priority
    return { priority: 0, timestamp: timeUntilDeadline };
  } else if (timeUntilDeadline <= HOURS_48) {
    // Due soon (within ~48 hours) - second highest
    return { priority: 1, timestamp: timeUntilDeadline };
  } else {
    // Future deadline - normal priority
    return { priority: 2, timestamp: deadlineTime };
  }
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  tasks: Task[];
  columns: ColumnData[];
  boardMembers: BoardMemberData[];
  onTaskClick: (task: Task) => void;
  /** Same signature as Board's handleAddTask */
  onAddTask: (title: string, column: string) => Promise<void>;
}

type SortKey = "title" | "phase" | "priority" | "deadline";

export default function ListView({ tasks, columns, boardMembers, onTaskClick, onAddTask }: Props) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColumn, setNewColumn] = useState<string>(() => columns[0]?.id ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const inputRef = useRef<HTMLInputElement>(null);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!columnDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setColumnDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [columnDropdownOpen]);

  // Build index maps for O(1) lookups
  const columnMap = useMemo(
    () => new Map(columns.map((c, i) => [c.id, { ...c, paletteIdx: i }])),
    [columns]
  );
  const memberMap = useMemo(
    () => new Map(boardMembers.map((m) => [m.id, m])),
    [boardMembers]
  );

  const handleOpenAdd = useCallback(() => {
    setNewColumn(columns[0]?.id ?? "");
    setNewTitle("");
    setAddingTask(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [columns]);

  const handleSubmit = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || !newColumn) { setAddingTask(false); setNewTitle(""); return; }
    setIsSaving(true);
    try {
      await onAddTask(title, newColumn);
      setNewTitle("");
      setAddingTask(false);
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setIsSaving(false);
    }
  }, [newTitle, newColumn, onAddTask]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") { setAddingTask(false); setNewTitle(""); }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Sort tasks based on active sort key and direction
  const sorted = [...tasks].sort((a, b) => {
    let diff = 0;
    
    if (sortKey === "title") {
      diff = a.title.localeCompare(b.title);
    } else if (sortKey === "phase") {
      const colA = columnMap.get(a.column)?.label ?? "";
      const colB = columnMap.get(b.column)?.label ?? "";
      diff = colA.localeCompare(colB);
    } else if (sortKey === "priority") {
      diff = (PRIORITY_ORDER[a.priority ?? "medium"] ?? 9) - (PRIORITY_ORDER[b.priority ?? "medium"] ?? 9);
    } else if (sortKey === "deadline") {
      // Smart deadline prioritization: overdue > due-soon > future > no-deadline
      const priorityA = getDeadlineSortPriority(a.deadline, a.completedAt);
      const priorityB = getDeadlineSortPriority(b.deadline, b.completedAt);
      
      if (priorityA.priority !== priorityB.priority) {
        diff = priorityA.priority - priorityB.priority;
      } else {
        // Within same priority level, sort by timestamp
        diff = priorityA.timestamp - priorityB.timestamp;
      }
    }
    
    if (diff === 0) diff = a.title.localeCompare(b.title); // stable tie-break
    return sortDir === "asc" ? diff : -diff;
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pl-[4.5rem] pr-6 md:px-10 py-6">
      {/* Toolbar: Add task */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted font-medium tabular-nums">
          {tasks.length === 0
            ? "No tasks"
            : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink bg-column-bg hover:bg-column-bg/70 transition-colors border border-border/40"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 1v8M1 5h8" />
          </svg>
          Add task
        </button>
      </div>

      {/* Inline add-task row */}
      {addingTask && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2.5 rounded-xl bg-column-bg border border-border/60 motion-safe:animate-fade-in">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title…"
            className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
          />
          <div ref={columnDropdownRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setColumnDropdownOpen((v) => !v)}
              className="
                bg-column-bg rounded-xl px-4 py-2.5
                text-sm text-ink
                border border-transparent hover:border-border
                transition-colors cursor-pointer text-left
                flex items-center gap-2 min-w-max
              "
            >
              <span className="truncate text-xs">{columns.find((c) => c.id === newColumn)?.label ?? "Select"}</span>
              <svg className="flex-shrink-0 text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4l4 4 4-4"/>
              </svg>
            </button>

            {columnDropdownOpen && (
              <div
                className="absolute z-10 mt-1 w-max min-w-max bg-card-bg border border-border rounded-xl shadow-modal overflow-hidden"
              >
                {columns.map((c) => {
                  const isSelected = c.id === newColumn;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setNewColumn(c.id);
                        setColumnDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        isSelected
                          ? "bg-column-bg text-ink font-medium"
                          : "text-ink hover:bg-column-bg"
                      }`}
                    >
                      <span className="truncate">{c.label}</span>
                      {isSelected && (
                        <svg className="ml-auto flex-shrink-0 text-ink" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newTitle.trim() || isSaving}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-ink text-paper text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {isSaving ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => { setAddingTask(false); setNewTitle(""); }}
            className="flex-shrink-0 p-1 rounded-md text-muted hover:text-ink transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 mb-1 select-none">
        <button
          onClick={() => handleSort("title")}
          className={`inline-flex items-center gap-0.5 flex-1 min-w-0 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors hover:text-ink ${
            sortKey === "title" ? "text-ink" : "text-muted/70"
          }`}
        >
          Title
          <span className="opacity-60">{sortKey === "title" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "\u2195"}</span>
        </button>
        <button
          onClick={() => handleSort("phase")}
          className={`w-24 flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-left cursor-pointer transition-colors hover:text-ink ${
            sortKey === "phase" ? "text-ink" : "text-muted/70"
          }`}
        >
          Phase
          <span className="ml-1 opacity-60">{sortKey === "phase" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "\u2195"}</span>
        </button>
        <button
          onClick={() => handleSort("priority")}
          className={`w-16 flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-left cursor-pointer transition-colors hover:text-ink ${
            sortKey === "priority" ? "text-ink" : "text-muted/70"
          }`}
        >
          Priority
          <span className="ml-1 opacity-60">{sortKey === "priority" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "\u2195"}</span>
        </button>
        <span className="w-7 flex-shrink-0" aria-label="Assignee" />
        <button
          onClick={() => handleSort("deadline")}
          className={`w-20 flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-right cursor-pointer transition-colors hover:text-ink ${
            sortKey === "deadline" ? "text-ink" : "text-muted/70"
          }`}
        >
          Deadline
          <span className="ml-1 opacity-60">{sortKey === "deadline" ? (sortDir === "asc" ? "\u2191" : "\u2193") : "\u2195"}</span>
        </button>
      </div>

      {/* Separator */}
      <div className="h-px bg-border/40 mb-1" />

      {/* Task rows */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-sm text-muted">No tasks yet.</p>
          <button
            onClick={handleOpenAdd}
            className="text-xs font-semibold text-accent hover:underline"
          >
            + Add your first task
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {sorted.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              columnEntry={columnMap.get(task.column)}
              member={task.assigneeId ? memberMap.get(task.assigneeId) ?? null : null}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TaskRow ────────────────────────────────────────────────────

interface RowProps {
  task: Task;
  columnEntry: (ColumnData & { paletteIdx: number }) | undefined;
  member: BoardMemberData | null;
  onClick: () => void;
}

function TaskRow({ task, columnEntry, member, onClick }: RowProps) {
  const p = task.priority ?? "medium";
  const pCfg = PRIORITY_CONFIG[p] ?? PRIORITY_CONFIG.medium;
  const colColor = columnEntry
    ? COLUMN_PALETTE[columnEntry.paletteIdx % COLUMN_PALETTE.length]
    : COLUMN_PALETTE[0];
  const deadlineInfo = formatDeadlineLabel(task.deadline, task.completedAt);

  const deadlineColor =
    deadlineInfo.severity === "overdue"
      ? "text-red-500 dark:text-red-400"
      : deadlineInfo.severity === "due-soon"
      ? "text-orange-500 dark:text-orange-400"
      : "text-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full flex items-center gap-3 px-3 py-2.5
        text-left rounded-lg
        hover:bg-column-bg/60 active:bg-column-bg
        transition-colors duration-100 group
      "
    >
      {/* Title */}
      <span className="flex-1 min-w-0 text-sm font-medium text-ink leading-snug truncate group-hover:text-ink/90">
        {task.title}
      </span>

      {/* Phase / column pill */}
      <span className={`w-24 flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${colColor.pill} truncate`}>
        <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${colColor.dot}`} />
        <span className="truncate">{columnEntry?.label ?? "—"}</span>
      </span>

      {/* Priority badge */}
      <span className={`w-16 flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${pCfg.badge} ${pCfg.text}`}>
        <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${pCfg.dot}`} />
        {pCfg.label}
      </span>

      {/* Assignee avatar */}
      <span className="w-7 flex-shrink-0 flex items-center justify-center">
        {member ? (
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: member.color || nameToColor(member.name) }}
            title={member.name}
          >
            {member.name.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full border border-border/60 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-muted/40" />
          </span>
        )}
      </span>

      {/* Deadline */}
      <span className={`w-20 flex-shrink-0 text-[11px] font-medium text-right tabular-nums ${deadlineInfo.severity === "none" ? "text-muted/50" : deadlineColor}`}>
        {deadlineInfo.severity === "none" ? "—" : deadlineInfo.label}
      </span>
    </button>
  );
}
