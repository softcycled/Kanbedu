import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, isMemberOfBoard } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getBoardNameOverrides } from "@/lib/classNames";

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
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });


  // Limit history lookback to 90 days — prevents unbounded scans on long-lived boards
  const HISTORY_CUTOFF = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Run columns and tasks in parallel — tasks filter via relation instead of prefetching IDs
  const [columns, tasks, nameOverrides] = await Promise.all([
    prisma.column.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
    }),
    // Explicit select keeps the payload lean — skips description (up to 50KB
    // per task) and other fields analytics never reads.
    prisma.task.findMany({
      where: { columnRel: { boardId } },
      select: {
        id: true,
        title: true,
        priority: true,
        column: true,
        columnUpdatedAt: true,
        createdAt: true,
        completedAt: true,
        deadline: true,
        movedByNonAssignee: true,
        _count: { select: { comments: true } },
        columnHistory: {
          where: { enteredAt: { gte: HISTORY_CUTOFF } },
          orderBy: { enteredAt: "asc" },
          select: { columnId: true, enteredAt: true, exitedAt: true },
        },
        assigneeId: true,
        assigneeUser: { select: { name: true, handle: true } },
        assignees: {
          orderBy: { assignedAt: "asc" },
          select: { userId: true, user: { select: { name: true, handle: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Class group boards show educator-set roster names in analytics
    getBoardNameOverrides(boardId),
  ]);

  if (columns.length === 0) {
    return NextResponse.json({
      columns: [],
      tasks: [],
      summary: { total: 0, completed: 0, inProgress: 0, overdue: 0, avgCycleTimeMs: null },
    });
  }

  const now = new Date();
  const columnMap = new Map(columns.map((c) => [c.id, c]));

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
      order: col.order,
      isDone: col.isDone,
      currentTaskCount: currentTasks.length,
      throughput,
      avgPhaseTimeMs,
      longestStagnantMs,
      longestStagnantTitle,
    };
  });

  // ── Bottleneck detection ──────────────────────────────────────
  // Score = currentTaskCount × avgPhaseTimeMs (or currentPhaseMs proxy if no avg).
  // Only non-done columns with at least 1 task are candidates.
  // Exactly one column gets the bottleneck flag — the one with the highest score.
  // Require at least 2 tasks to flag a bottleneck — avoids mislabeling on small boards
  const nonDonePhases = phaseStats.filter((p) => !p.isDone && p.currentTaskCount >= 2);
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

  // ── Task details ──────────────────────────────────────────────
  const nonDoneColumnIdSet = new Set(columns.filter((c) => !c.isDone).map((c) => c.id));

  // Resolve display names for a task's full assignee set (roster override →
  // @handle → name). Falls back to the legacy single assignee for old rows.
  const getAssigneeNames = (t: (typeof tasks)[number]): string[] => {
    if (t.assignees.length > 0) {
      return t.assignees.map(
        (a) =>
          nameOverrides.get(a.userId) ??
          (a.user.handle ? `@${a.user.handle}` : a.user.name || "(unknown)")
      );
    }
    if (t.assigneeId) {
      return [
        nameOverrides.get(t.assigneeId) ??
          (t.assigneeUser?.handle ? `@${t.assigneeUser.handle}` : t.assigneeUser?.name || "(unknown)"),
      ];
    }
    return [];
  };

  const taskDetails = tasks.map((t) => {
    const col = columnMap.get(t.column);
    const isDone = col?.isDone ?? false;
    // Cycle time: completedAt if available, else null
    const cycleTimeMs = t.completedAt
      ? t.completedAt.getTime() - t.createdAt.getTime()
      : null;
    // currentPhaseMs is only meaningful for active tasks; freeze at 0 for done tasks
    // so they never trip the stagnant threshold in per-column cards.
    const enteredCurrentColumn = getEnteredCurrentColumn(t);
    const currentPhaseMs = isDone ? 0 : now.getTime() - enteredCurrentColumn.getTime();
    // Age freezes at completedAt for done tasks so it doesn't keep growing
    const totalAgeMs = isDone && t.completedAt
      ? t.completedAt.getTime() - t.createdAt.getTime()
      : now.getTime() - t.createdAt.getTime();

    // Count distinct non-done columns this task has visited (via history)
    const visitedColumnCount = new Set(
      t.columnHistory.map((h) => h.columnId).filter((cid) => nonDoneColumnIdSet.has(cid))
    ).size;

    return {
      id: t.id,
      title: t.title,
      assignee: getAssigneeNames(t).join(", ") || "(unassigned)",
      priority: t.priority,
      columnId: t.column,
      columnLabel: col?.label ?? t.column,
      columnIsDone: isDone,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      deadline: t.deadline?.toISOString() ?? null,
      commentCount: t._count.comments,
      cycleTimeMs,
      currentPhaseMs,
      totalAgeMs,
      visitedColumnCount,
    };
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

  const cycleTimes = taskDetails
    .filter((t) => t.cycleTimeMs !== null)
    .map((t) => t.cycleTimeMs!);
  const avgCycleTimeMs =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // Stagnation: in-progress tasks that haven't moved in 3+ days
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const activeTasks = taskDetails.filter((t) => !t.columnIsDone);
  const stagnantCount = activeTasks.filter((t) => t.currentPhaseMs > THREE_DAYS_MS).length;

  // Comment density: avg comments per task
  const totalComments = tasks.reduce((sum, t) => sum + t._count.comments, 0);
  const commentDensity = tasks.length > 0 ? totalComments / tasks.length : 0;

  // Integrity check: flag completed tasks that look like last-minute fabrication.
  // A task is suspicious if it was completed extremely quickly (speed-run) or if it
  // bypassed intermediate columns without passing through them (column-skipping).
  const SPEED_RUN_MS = 30 * 60 * 1000; // 30 minutes
  const totalNonDoneColumns = columns.filter((c) => !c.isDone).length;
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const suspiciousTasks = taskDetails
    .filter((t) => {
      const rawTask = taskById.get(t.id);
      const isMovedByOther = rawTask?.movedByNonAssignee ?? false;
      return (t.columnIsDone && t.cycleTimeMs !== null) || isMovedByOther;
    })
    .map((t) => {
      const rawTask = taskById.get(t.id)!;
      return {
        id: t.id,
        title: t.title,
        assignee: t.assignee,
        cycleTimeMs: t.cycleTimeMs ?? 0,
        visitedColumnCount: t.visitedColumnCount,
        isSpeedRun: t.columnIsDone && t.cycleTimeMs !== null && t.cycleTimeMs < SPEED_RUN_MS,
        isColumnSkip: t.columnIsDone && totalNonDoneColumns > 1 && t.visitedColumnCount < totalNonDoneColumns,
        isMovedByOther: rawTask.movedByNonAssignee,
      };
    })
    .filter((t) => t.isSpeedRun || t.isColumnSkip || t.isMovedByOther);

  // Deadline adherence: completed tasks with a deadline.
  // Use setUTCHours to extend to end-of-UTC-day — consistent regardless of server timezone.
  const completedWithDeadline = tasks.filter((t) => t.completedAt && t.deadline);
  const onTime = completedWithDeadline.filter((t) => {
    const endOfDeadlineDay = new Date(t.deadline!);
    endOfDeadlineDay.setUTCHours(23, 59, 59, 999);
    return t.completedAt!.getTime() <= endOfDeadlineDay.getTime();
  }).length;

  // ── Assignee breakdown ────────────────────────────────────────
  const assigneeMap = new Map<
    string,
    { total: number; completed: number; overdue: number; cycleTimes: number[] }
  >();

  // Distribute each task to every one of its assignees — a shared task counts
  // toward each member's totals. taskDetails is index-aligned with tasks.
  tasks.forEach((rawTask, i) => {
    const t = taskDetails[i];
    for (const name of getAssigneeNames(rawTask)) {
      if (!assigneeMap.has(name)) {
        assigneeMap.set(name, { total: 0, completed: 0, overdue: 0, cycleTimes: [] });
      }
      const entry = assigneeMap.get(name)!;
      entry.total++;
      if (t.columnIsDone) entry.completed++;
      if (t.deadline && endOfDay(new Date(t.deadline)) < now && !t.columnIsDone) entry.overdue++;
      if (t.cycleTimeMs !== null) entry.cycleTimes.push(t.cycleTimeMs);
    }
  });

  const assignees = Array.from(assigneeMap.entries())
    .map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      overdue: data.overdue,
      avgCycleTimeMs:
        data.cycleTimes.length > 0
          ? data.cycleTimes.reduce((a, b) => a + b, 0) / data.cycleTimes.length
          : null,
    }))
    .sort((a, b) => b.total - a.total);

  // Detect tasks whose history was silently truncated by HISTORY_CUTOFF: created before
  // the cutoff but have no history entries (their move history was pruned).
  const historyTruncated = tasks.some(
    (t) => t.createdAt < HISTORY_CUTOFF && t.columnHistory.length === 0
  );

  return NextResponse.json(
    {
      columns: phaseStatsWithBottleneck,
      tasks: taskDetails,
      assignees,
      summary: {
        total: tasks.length,
        completed,
        inProgress: inProgressCount,
        overdue,
        avgCycleTimeMs,
        stagnantCount,
        stagnantRate: activeTasks.length > 0 ? stagnantCount / activeTasks.length : 0,
        commentDensity,
        deadlineAdherence:
          completedWithDeadline.length > 0
            ? { onTime, total: completedWithDeadline.length }
            : null,
        suspiciousTasks,
        historyTruncated,
      },
    },
    // Analytics tolerates short staleness — let the browser reuse a recent
    // response instead of re-hitting the DB on every panel open.
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  );
}
