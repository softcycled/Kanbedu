"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// -- Types --

interface CalendarTask {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  isDone: boolean;
  boardId: string;
  boardName: string;
  assignee: { name: string; color: string } | null;
}

// -- Constants --

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// -- Helpers --

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  // Shift so Monday=0, Sunday=6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  // Leading empty cells
  for (let i = 0; i < startDay; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Trailing empty cells to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Split into weeks
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// -- Component --

export default function CalendarPanel() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Group tasks by date key
  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const t of tasks) {
      const key = t.deadline.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const weeks = getMonthGrid(year, month);

  // Tasks for the selected date panel
  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    return tasksByDate[key] || [];
  }, [selectedDate, tasksByDate]);

  // Navigation
  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(now);
  };

  if (loading && tasks.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading calendar…</div>;
  }

  // Count overdue (non-done tasks past their deadline)
  const now = new Date();
  const overdueCount = tasks.filter((t) => !t.isDone && new Date(t.deadline) < now).length;
  const upcomingCount = tasks.filter((t) => {
    const d = new Date(t.deadline);
    return !t.isDone && d >= now && d.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-32 md:py-8 no-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="pl-14 md:pl-0">
          <h2 className="text-xl font-bold text-ink">Deadline Calendar</h2>
          <p className="text-sm text-muted mt-0.5">All boards</p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-card-bg border border-border text-ink hover:bg-border transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Summary strip */}
      <div className="flex gap-3 mb-6">
        <div className="bg-card-bg rounded-xl border border-border px-4 py-3 flex-1">
          <div className="text-2xl font-bold text-ink">{tasks.length}</div>
          <div className="text-xs text-muted mt-0.5">Total deadlines</div>
        </div>
        <div className="bg-card-bg rounded-xl border border-border px-4 py-3 flex-1">
          <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-500" : "text-ink"}`}>{overdueCount}</div>
          <div className="text-xs text-muted mt-0.5">Overdue</div>
        </div>
        <div className="bg-card-bg rounded-xl border border-border px-4 py-3 flex-1">
          <div className={`text-2xl font-bold ${upcomingCount > 0 ? "text-blue-600" : "text-ink"}`}>{upcomingCount}</div>
          <div className="text-xs text-muted mt-0.5">Due this week</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Calendar grid */}
        <div className="flex-1">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-ink">{MONTH_NAMES[month]} {year}</h3>
              <button onClick={goToToday} className="text-[10px] px-2 py-0.5 rounded-md bg-border/50 text-muted hover:text-ink hover:bg-border transition-colors font-semibold uppercase tracking-wider">Today</button>
            </div>
            <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-border/50 transition-colors text-muted hover:text-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted py-1.5">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
            {weeks.map((week, wi) => (
              <div key={wi} className={`grid grid-cols-7 ${wi > 0 ? "border-t border-border" : ""}`}>
                {week.map((date, di) => {
                  if (!date) {
                    return <div key={`empty-${di}`} className="min-h-[80px] bg-column-bg/30" />;
                  }

                  const key = toDateKey(date);
                  const dayTasks = tasksByDate[key] || [];
                  const isToday = isSameDay(date, today);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const hasOverdue = dayTasks.some((t) => !t.isDone && new Date(t.deadline) < now);
                  const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.isDone);

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[80px] p-1.5 cursor-pointer transition-colors relative ${
                        isSelected
                          ? "bg-ink/5 ring-1 ring-inset ring-ink/20"
                          : "hover:bg-border/20"
                      } ${di > 0 ? "border-l border-border" : ""}`}
                    >
                      {/* Day number */}
                      <div className={`text-xs font-medium mb-1 ${
                        isToday
                          ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center"
                          : "text-muted px-0.5"
                      }`}>
                        {date.getDate()}
                      </div>

                      {/* Task dots */}
                      {dayTasks.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {dayTasks.slice(0, 3).map((t) => (
                            <div
                              key={t.id}
                              className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${
                                t.isDone
                                  ? "text-muted line-through opacity-60"
                                  : hasOverdue && !t.isDone && new Date(t.deadline) < now
                                    ? "text-red-600 font-medium"
                                    : "text-ink"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                t.isDone ? "bg-green-400" : (PRIORITY_DOT[t.priority] || "bg-gray-400")
                              }`} />
                              <span className="truncate">{t.title}</span>
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <span className="text-[9px] text-muted pl-1">+{dayTasks.length - 3} more</span>
                          )}
                        </div>
                      )}

                      {/* Done indicator */}
                      {allDone && (
                        <div className="absolute top-1.5 right-1.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="w-full md:w-72 flex-shrink-0">
          <div className="bg-card-bg rounded-xl border border-border p-4 sticky top-8">
            {selectedDate ? (
              <>
                <h4 className="text-sm font-bold text-ink mb-1">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h4>
                <p className="text-xs text-muted mb-4">
                  {selectedTasks.length === 0
                    ? "No deadlines"
                    : `${selectedTasks.length} deadline${selectedTasks.length !== 1 ? "s" : ""}`}
                </p>

                {selectedTasks.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {selectedTasks.map((t) => {
                      const isOverdue = !t.isDone && new Date(t.deadline) < now;
                      return (
                        <div
                          key={t.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            t.isDone
                              ? "border-green-600/20 bg-green-600/5 opacity-70"
                              : isOverdue
                                ? "border-red-500/20 bg-red-500/5"
                                : "border-border hover:border-ink/20"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                              t.isDone ? "bg-green-400" : (PRIORITY_DOT[t.priority] || "bg-gray-400")
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-medium leading-tight ${t.isDone ? "line-through text-muted" : "text-ink"}`}>
                                {t.title}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-muted font-medium truncate max-w-[120px]">
                                  {t.boardName}
                                </span>
                                {t.isDone && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">Done</span>
                                )}
                                {isOverdue && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold">Overdue</span>
                                )}
                              </div>
                              {t.assignee && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div
                                    className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: t.assignee.color }}
                                  >
                                    {t.assignee.name.charAt(0)}
                                  </div>
                                  <span className="text-[10px] text-muted truncate">{t.assignee.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto text-muted/40 mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p className="text-sm text-muted">Select a day to view deadlines</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
