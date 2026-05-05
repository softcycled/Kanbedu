import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  if (!boardId) {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }

  const columns = await prisma.column.findMany({
    where: { boardId },
    orderBy: { order: "asc" },
  });

  const columnIds = columns.map((c) => c.id);

  if (columnIds.length === 0) {
    return NextResponse.json({
      columns: [],
      tasks: [],
      summary: { total: 0, completed: 0, inProgress: 0, overdue: 0, avgCycleTimeMs: null },
    });
  }

  const tasks = await prisma.task.findMany({
    where: { column: { in: columnIds } },
    include: {
      comments: true,
      columnHistory: { orderBy: { enteredAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const columnMap = new Map(columns.map((c) => [c.id, c]));

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
    const currentTasks = tasks.filter((t) => t.column === col.id);

    // Avg time in phase:
    // - Non-done columns: closed history entries only (exitedAt - enteredAt)
    // - Done column: open entries (now - enteredAt) + closed entries
    //   Fallback: completedAt - createdAt for tasks without any history
    const closedEntries = tasks.flatMap((t) =>
      t.columnHistory.filter((h) => h.columnId === col.id && h.exitedAt !== null)
    );
    const closedTimes = closedEntries.map(
      (h) => h.exitedAt!.getTime() - h.enteredAt.getTime()
    );

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

    return {
      id: col.id,
      label: col.label,
      order: col.order,
      isDone: col.isDone,
      currentTaskCount: currentTasks.length,
      avgPhaseTimeMs,
      longestStagnantMs,
      longestStagnantTitle,
    };
  });

  // ── Task details ──────────────────────────────────────────────
  const nonDoneColumnIdSet = new Set(columns.filter((c) => !c.isDone).map((c) => c.id));

  const taskDetails = tasks.map((t) => {
    const col = columnMap.get(t.column);
    const isDone = col?.isDone ?? false;
    // Cycle time: completedAt if available, else null
    const cycleTimeMs = t.completedAt
      ? t.completedAt.getTime() - t.createdAt.getTime()
      : null;
    // Use open history enteredAt for currentPhaseMs — same source as phase stats
    const enteredCurrentColumn = getEnteredCurrentColumn(t);
    const currentPhaseMs = now.getTime() - enteredCurrentColumn.getTime();
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
      assignee: t.assignee,
      priority: t.priority,
      columnId: t.column,
      columnLabel: col?.label ?? t.column,
      columnIsDone: isDone,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
      deadline: t.deadline?.toISOString() ?? null,
      commentCount: t.comments.length,
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
  // Overdue: tasks in active (non-done) columns that are past their deadline
  const overdue = tasks.filter(
    (t) => t.deadline && t.deadline < now && !(columnMap.get(t.column)?.isDone)
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
  const totalComments = tasks.reduce((sum, t) => sum + t.comments.length, 0);
  const commentDensity = tasks.length > 0 ? totalComments / tasks.length : 0;

  // Integrity check: flag completed tasks that look like last-minute fabrication.
  // A task is suspicious if it was completed extremely quickly (speed-run) or if it
  // bypassed intermediate columns without passing through them (column-skipping).
  const SPEED_RUN_MS = 30 * 60 * 1000; // 30 minutes
  const totalNonDoneColumns = columns.filter((c) => !c.isDone).length;
  const suspiciousTasks = taskDetails
    .filter((t) => t.columnIsDone && t.cycleTimeMs !== null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      assignee: t.assignee,
      cycleTimeMs: t.cycleTimeMs!,
      visitedColumnCount: t.visitedColumnCount,
      isSpeedRun: t.cycleTimeMs! < SPEED_RUN_MS,
      isColumnSkip: totalNonDoneColumns > 1 && t.visitedColumnCount < totalNonDoneColumns,
    }))
    .filter((t) => t.isSpeedRun || t.isColumnSkip);

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

  for (const t of taskDetails) {
    const name = t.assignee || "(unassigned)";
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { total: 0, completed: 0, overdue: 0, cycleTimes: [] });
    }
    const entry = assigneeMap.get(name)!;
    entry.total++;
    if (t.columnIsDone) entry.completed++;
    if (t.deadline && new Date(t.deadline) < now && !t.columnIsDone) entry.overdue++;
    if (t.cycleTimeMs !== null) entry.cycleTimes.push(t.cycleTimeMs);
  }

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

  return NextResponse.json({
    columns: phaseStats,
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
    },
  });
}
