import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, isMemberOfBoard } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";

export async function GET(request: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(session.userId, "analytics_read", 60, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  if (!boardId) {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }

  const allowed = await isMemberOfBoard(session.userId, boardId);
  if (!allowed) {
    logAuthzDenied(request, "/api/analytics", session.userId, "GET cross-tenant");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  // Limit history lookback to 90 days — prevents unbounded scans on long-lived boards
  const HISTORY_CUTOFF = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Columns and tasks run in parallel. Select is intentionally narrow: this
  // route only ever powers charts (workload by phase, priority mix, weekly
  // completion trend, cycle-time/stagnation/deadline aggregates) -- no
  // per-task title, assignee, or comment data leaves this route anymore, so
  // none of it is fetched. Cuts a join (comment _count), a relation
  // (assignees + assigneeUser), and a whole second query (roster name
  // overrides) that existed only to resolve assignee display names.
  const [columns, tasks] = await Promise.all([
    prisma.column.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { columnRel: { boardId }, deletedAt: null },
      select: {
        id: true,
        title: true,
        priority: true,
        column: true,
        columnUpdatedAt: true,
        createdAt: true,
        completedAt: true,
        deadline: true,
        columnHistory: {
          where: { enteredAt: { gte: HISTORY_CUTOFF } },
          orderBy: { enteredAt: "asc" },
          select: { columnId: true, enteredAt: true, exitedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (columns.length === 0) {
    return NextResponse.json({
      columns: [],
      weeklyCompletions: [],
      priorityMix: [],
      summary: {
        total: 0, completed: 0, inProgress: 0, overdue: 0, avgCycleTimeMs: null,
        stagnantCount: 0, stagnantRate: 0, deadlineAdherence: null, historyTruncated: false,
      },
    });
  }

  const now = new Date();
  const columnMap = new Map(columns.map((c) => [c.id, c]));
  // The first column is intake (To Do / Backlog / Wishlist) -- cards sit there
  // by design until someone picks them up, so it's excluded from "stagnant"
  // alongside Done. Only columns in between count as active work in progress.
  const firstColumnId = columns[0]?.id ?? null;

  function endOfDay(d: Date): Date {
    const r = new Date(d);
    r.setUTCHours(23, 59, 59, 999);
    return r;
  }

  // Pre-bucket once so phase stats are O(tasks × history) instead of
  // O(columns × tasks × history). One pass groups current tasks by column and
  // collects each column's closed-history durations + distinct task ids.
  const currentTasksByColumn = new Map<string, typeof tasks>();
  const closedTimesByColumn = new Map<string, number[]>();
  const throughputIdsByColumn = new Map<string, Set<string>>();
  for (const t of tasks) {
    const bucket = currentTasksByColumn.get(t.column) ?? [];
    bucket.push(t);
    currentTasksByColumn.set(t.column, bucket);
    for (const h of t.columnHistory) {
      if (h.exitedAt === null) continue;
      const times = closedTimesByColumn.get(h.columnId) ?? [];
      times.push(h.exitedAt.getTime() - h.enteredAt.getTime());
      closedTimesByColumn.set(h.columnId, times);
      const ids = throughputIdsByColumn.get(h.columnId) ?? new Set<string>();
      ids.add(t.id);
      throughputIdsByColumn.set(h.columnId, ids);
    }
  }

  // Helper: find when a task entered its CURRENT column (open history entry).
  // Falls back to columnUpdatedAt, then createdAt.
  const getEnteredCurrentColumn = (t: (typeof tasks)[number]): Date => {
    const open = t.columnHistory
      .filter((h) => h.columnId === t.column && h.exitedAt === null)
      .sort((a, b) => b.enteredAt.getTime() - a.enteredAt.getTime())[0];
    return open?.enteredAt ?? new Date(t.columnUpdatedAt) ?? t.createdAt;
  };

  // ── Phase stats ───────────────────────────────────────────────
  const phaseStats = columns.map((col) => {
    const currentTasks = currentTasksByColumn.get(col.id) ?? [];

    // Avg time in phase:
    // - Non-done columns: closed history entries only (exitedAt - enteredAt)
    // - Done column: open entries (now - enteredAt) + closed entries
    //   Fallback: completedAt - createdAt for tasks without any history
    const closedTimes = closedTimesByColumn.get(col.id) ?? [];

    let avgPhaseTimeMs: number | null = null;

    if (col.isDone) {
      const openEntries = currentTasks.flatMap((t) =>
        t.columnHistory.filter((h) => h.columnId === col.id && h.exitedAt === null)
      );
      const openTimes = openEntries.map((h) => now.getTime() - h.enteredAt.getTime());
      const allTimes = [...closedTimes, ...openTimes];
      if (allTimes.length > 0) {
        avgPhaseTimeMs = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      } else {
        // Fallback: use cycle time (completedAt - createdAt) for done tasks
        const doneCycleTimes = currentTasks
          .filter((t) => t.completedAt)
          .map((t) => t.completedAt!.getTime() - t.createdAt.getTime());
        avgPhaseTimeMs =
          doneCycleTimes.length > 0
            ? doneCycleTimes.reduce((a, b) => a + b, 0) / doneCycleTimes.length
            : null;
      }
    } else {
      avgPhaseTimeMs =
        closedTimes.length > 0
          ? closedTimes.reduce((a, b) => a + b, 0) / closedTimes.length
          : null;
    }

    // Longest waiting current task — use open history enteredAt as source of truth
    let longestStagnantMs: number | null = null;
    let longestStagnantTitle: string | null = null;
    if (currentTasks.length > 0) {
      const withEnteredAt = currentTasks.map((t) => ({
        title: t.title,
        enteredAt: getEnteredCurrentColumn(t),
      }));
      withEnteredAt.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
      const oldest = withEnteredAt[0];
      longestStagnantMs = now.getTime() - oldest.enteredAt.getTime();
      longestStagnantTitle = oldest.title;
    }

    // Throughput: tasks that have fully exited this column (closed history entries)
    const throughput = (throughputIdsByColumn.get(col.id) ?? new Set<string>()).size;

    return {
      id: col.id,
      label: col.label,
      isDone: col.isDone,
      isFirst: col.id === firstColumnId,
      currentTaskCount: currentTasks.length,
      throughput,
      avgPhaseTimeMs,
      longestStagnantMs,
      longestStagnantTitle,
    };
  });

  // ── Bottleneck detection ──────────────────────────────────────
  // Score = currentTaskCount × avgPhaseTimeMs (or currentPhaseMs proxy if no avg).
  // Only middle columns (not intake, not Done) with at least 1 task are candidates --
  // a big backlog aging in the first column is expected, not a bottleneck.
  // Exactly one column gets the bottleneck flag — the one with the highest score.
  // Require at least 2 tasks to flag a bottleneck — avoids mislabeling on small boards
  const nonDonePhases = phaseStats.filter((p) => !p.isDone && !p.isFirst && p.currentTaskCount >= 2);
  let bottleneckId: string | null = null;
  if (nonDonePhases.length > 0) {
    const scored = nonDonePhases.map((p) => ({
      id: p.id,
      score: p.currentTaskCount * (p.avgPhaseTimeMs ?? 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score > 0) bottleneckId = scored[0].id;
  }

  const phaseStatsWithBottleneck = phaseStats.map((p) => ({
    ...p,
    isBottleneck: p.id === bottleneckId,
  }));

  // ── Task aggregates ──────────────────────────────────────────
  // Per-task cycle/phase time, kept as plain values -- never returned
  // per-task, only the aggregates below (and the weekly/priority
  // breakdowns further down) go out over the wire. This keeps the response
  // size bounded by column count + a fixed handful of weeks/priorities
  // instead of growing linearly with the number of tasks on the board.
  const taskAggregates = tasks.map((t) => {
    const col = columnMap.get(t.column);
    const isDone = col?.isDone ?? false;
    const cycleTimeMs = t.completedAt ? t.completedAt.getTime() - t.createdAt.getTime() : null;
    // currentPhaseMs is only meaningful for active tasks; freeze at 0 for done
    // tasks so they never trip the stagnant threshold.
    const currentPhaseMs = isDone ? 0 : now.getTime() - getEnteredCurrentColumn(t).getTime();
    return { priority: t.priority, columnId: t.column, columnIsDone: isDone, cycleTimeMs, currentPhaseMs };
  });

  // ── Summary ───────────────────────────────────────────────────
  // Base completion on column type (isDone), not completedAt, so cards always add up:
  //   completed + inProgress === total
  const completed = tasks.filter((t) => columnMap.get(t.column)?.isDone).length;
  const inProgressCount = tasks.length - completed;
  // Overdue: tasks in active (non-done) columns that are past their deadline (end-of-day)
  const overdue = tasks.filter(
    (t) => t.deadline && endOfDay(t.deadline) < now && !(columnMap.get(t.column)?.isDone)
  ).length;

  const cycleTimes = taskAggregates
    .filter((t) => t.cycleTimeMs !== null)
    .map((t) => t.cycleTimeMs!);
  const avgCycleTimeMs =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // Stagnation: tasks in a middle column (not the intake column, not Done)
  // that haven't moved in 3+ days. Backlog items are excluded -- they're
  // meant to sit untouched until someone picks them up.
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const activeTasks = taskAggregates.filter((t) => !t.columnIsDone && t.columnId !== firstColumnId);
  const stagnantCount = activeTasks.filter((t) => t.currentPhaseMs > THREE_DAYS_MS).length;

  // Deadline adherence: completed tasks with a deadline.
  // Use setUTCHours to extend to end-of-UTC-day — consistent regardless of server timezone.
  const completedWithDeadline = tasks.filter((t) => t.completedAt && t.deadline);
  const onTime = completedWithDeadline.filter((t) => {
    const endOfDeadlineDay = new Date(t.deadline!);
    endOfDeadlineDay.setUTCHours(23, 59, 59, 999);
    return t.completedAt!.getTime() <= endOfDeadlineDay.getTime();
  }).length;

  // Detect tasks whose history was silently truncated by HISTORY_CUTOFF: created before
  // the cutoff but have no history entries (their move history was pruned).
  const historyTruncated = tasks.some(
    (t) => t.createdAt < HISTORY_CUTOFF && t.columnHistory.length === 0
  );

  // ── Weekly completions (trend chart) ────────────────────────────
  // Monday-start buckets, oldest first, ending on the current (still
  // accumulating) week. Window shrinks to the board's real history (3-10
  // weeks) instead of always assuming 10, so a brand-new board doesn't show
  // nine empty weeks before any real data.
  function startOfWeek(d: Date): Date {
    const r = new Date(d);
    const day = r.getUTCDay();
    r.setUTCDate(r.getUTCDate() + ((day === 0 ? -6 : 1) - day));
    r.setUTCHours(0, 0, 0, 0);
    return r;
  }
  const thisWeekStart = startOfWeek(now);
  let earliestCreatedMs = now.getTime();
  for (const t of tasks) {
    const ts = t.createdAt.getTime();
    if (ts < earliestCreatedMs) earliestCreatedMs = ts;
  }
  const weeksOfHistory = Math.round((thisWeekStart.getTime() - startOfWeek(new Date(earliestCreatedMs)).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const weekCount = Math.min(10, Math.max(3, weeksOfHistory));
  const weeklyBuckets = Array.from({ length: weekCount }, (_, i) => {
    const start = new Date(thisWeekStart);
    start.setUTCDate(start.getUTCDate() - (weekCount - 1 - i) * 7);
    return { label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start, count: 0, isCurrent: i === weekCount - 1 };
  });
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const ts = t.completedAt.getTime();
    for (let i = weeklyBuckets.length - 1; i >= 0; i--) {
      if (ts >= weeklyBuckets[i].start.getTime()) { weeklyBuckets[i].count++; break; }
    }
  }
  const weeklyCompletions = weeklyBuckets.map(({ label, count, isCurrent }) => ({ label, count, isCurrent }));

  // ── Priority mix (open vs done per priority) ────────────────────
  const priorityCounts: Record<string, { open: number; done: number }> = {
    urgent: { open: 0, done: 0 }, high: { open: 0, done: 0 }, medium: { open: 0, done: 0 }, low: { open: 0, done: 0 },
  };
  for (const t of taskAggregates) {
    const bucket = priorityCounts[t.priority];
    if (!bucket) continue;
    if (t.columnIsDone) bucket.done++; else bucket.open++;
  }
  const priorityMix = (["urgent", "high", "medium", "low"] as const).map((p) => ({
    priority: p, open: priorityCounts[p].open, done: priorityCounts[p].done, total: priorityCounts[p].open + priorityCounts[p].done,
  }));

  return NextResponse.json(
    {
      columns: phaseStatsWithBottleneck,
      weeklyCompletions,
      priorityMix,
      summary: {
        total: tasks.length,
        completed,
        inProgress: inProgressCount,
        overdue,
        avgCycleTimeMs,
        stagnantCount,
        stagnantRate: activeTasks.length > 0 ? stagnantCount / activeTasks.length : 0,
        deadlineAdherence:
          completedWithDeadline.length > 0
            ? { onTime, total: completedWithDeadline.length }
            : null,
        historyTruncated,
      },
    },
    // Analytics tolerates short staleness — let the browser reuse a recent
    // response instead of re-hitting the DB on every panel open.
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  );
}
