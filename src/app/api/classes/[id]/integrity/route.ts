import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getClassRole } from "@/lib/auth";

// Integrity detection thresholds — kept in sync with the per-board analytics
// route (src/app/api/analytics/route.ts). A task is flagged if it was completed
// suspiciously fast, bypassed intermediate columns, or was moved to done by
// someone other than its assignee.
const SPEED_RUN_MS = 30 * 60 * 1000; // 30 minutes
const HISTORY_DAYS = 90;

// GET: integrity overview across ALL group boards in a class, grouped by team.
// Educator/TA only — this is the "are my students using the board honestly?"
// screen. Intentionally focused on integrity signals, not full analytics.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can view integrity." }, { status: 403 });
    }

    const groups = await prisma.group.findMany({
      where: { classId: id },
      orderBy: { order: "asc" },
      include: { board: { include: { columns: { orderBy: { order: "asc" } } } } },
    });

    // Map every column id -> its board and done-state, so a task (which only
    // knows its column id) can be bucketed back to its group board.
    const columnInfo = new Map<string, { boardId: string; isDone: boolean; label: string }>();
    const nonDoneCountByBoard = new Map<string, number>();
    // Ordered list of non-done columns per board — used to compute which
    // specific columns a task skipped.
    const orderedNonDoneByBoard = new Map<string, Array<{ id: string; label: string }>>();

    for (const g of groups) {
      let nonDone = 0;
      const nonDoneCols: Array<{ id: string; label: string }> = [];
      for (const c of g.board.columns) {
        columnInfo.set(c.id, { boardId: g.boardId, isDone: c.isDone, label: c.label });
        if (!c.isDone) {
          nonDone++;
          nonDoneCols.push({ id: c.id, label: c.label });
        }
      }
      nonDoneCountByBoard.set(g.boardId, nonDone);
      orderedNonDoneByBoard.set(g.boardId, nonDoneCols);
    }

    const historyCutoff = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const allColumnIds = [...columnInfo.keys()];

    const tasks =
      allColumnIds.length === 0
        ? []
        : await prisma.task.findMany({
            where: { column: { in: allColumnIds } },
            include: {
              assigneeUser: { select: { name: true, handle: true } },
              columnHistory: {
                where: { enteredAt: { gte: historyCutoff } },
                select: { columnId: true },
              },
            },
          });

    // For tasks flagged as movedByNonAssignee, look up who actually moved them
    // by finding the most recent MOVE activity where the actor isn't the assignee.
    const movedByTaskIds = tasks.filter((t) => t.movedByNonAssignee).map((t) => t.id);
    const taskAssigneeMap = new Map(tasks.map((t) => [t.id, t.assigneeId ?? null]));
    const movedByMap = new Map<string, string>(); // taskId -> display name

    if (movedByTaskIds.length > 0) {
      // Include COMPLETE activities — moving directly to a Done column records
      // "COMPLETE" not "MOVE", which is the most common pattern for cheating.
      const moveActivities = await prisma.taskActivity.findMany({
        where: { taskId: { in: movedByTaskIds }, type: { in: ["MOVE", "COMPLETE"] } },
        include: { user: { select: { name: true, handle: true } } },
        orderBy: { createdAt: "desc" },
      });
      for (const act of moveActivities) {
        if (movedByMap.has(act.taskId)) continue; // keep most recent
        const assigneeId = taskAssigneeMap.get(act.taskId);
        if (act.userId !== assigneeId) {
          movedByMap.set(act.taskId, act.user.handle ? `@${act.user.handle}` : act.user.name);
        }
      }
    }

    interface Flagged {
      id: string;
      title: string;
      assignee: string;
      cycleTimeMs: number;
      visitedColumnCount: number;
      columnLabel: string;
      isSpeedRun: boolean;
      isColumnSkip: boolean;
      isMovedByOther: boolean;
      movedBy: string;
      skippedColumns: string[];
    }
    const flaggedByBoard = new Map<string, Flagged[]>();

    for (const t of tasks) {
      const info = columnInfo.get(t.column);
      if (!info) continue;
      const isDone = info.isDone;
      const cycleTimeMs = t.completedAt ? t.completedAt.getTime() - t.createdAt.getTime() : null;

      // Compute visited non-done columns as a Set so we can reuse it for
      // both the count check and the skipped-column label lookup.
      const visitedNonDoneSet = new Set(
        t.columnHistory.map((h) => h.columnId).filter((cid) => {
          const ci = columnInfo.get(cid);
          return ci && !ci.isDone;
        })
      );
      const visitedColumnCount = visitedNonDoneSet.size;

      const totalNonDone = nonDoneCountByBoard.get(info.boardId) ?? 0;
      const isSpeedRun = isDone && cycleTimeMs !== null && cycleTimeMs < SPEED_RUN_MS;
      const isColumnSkip = isDone && totalNonDone > 1 && visitedColumnCount < totalNonDone;
      const isMovedByOther = t.movedByNonAssignee;

      if (!isSpeedRun && !isColumnSkip && !isMovedByOther) continue;

      const assignee = t.assigneeUser?.handle
        ? `@${t.assigneeUser.handle}`
        : t.assigneeUser?.name || "(unassigned)";

      const skippedColumns = isColumnSkip
        ? (orderedNonDoneByBoard.get(info.boardId) ?? [])
            .filter((c) => !visitedNonDoneSet.has(c.id))
            .map((c) => c.label)
        : [];

      const bucket = flaggedByBoard.get(info.boardId) ?? [];
      bucket.push({
        id: t.id,
        title: t.title,
        assignee,
        cycleTimeMs: cycleTimeMs ?? 0,
        visitedColumnCount,
        columnLabel: info.label,
        isSpeedRun,
        isColumnSkip,
        isMovedByOther,
        movedBy: movedByMap.get(t.id) ?? "",
        skippedColumns,
      });
      flaggedByBoard.set(info.boardId, bucket);
    }

    const resultGroups = groups.map((g) => ({
      groupId: g.id,
      name: g.name,
      boardId: g.boardId,
      realtimeSecret: g.board.realtimeSecret ?? null,
      flagged: flaggedByBoard.get(g.boardId) ?? [],
    }));

    const totalFlagged = resultGroups.reduce((sum, g) => sum + g.flagged.length, 0);
    const flaggedTeamCount = resultGroups.filter((g) => g.flagged.length > 0).length;

    return NextResponse.json({
      groups: resultGroups,
      totalFlagged,
      flaggedTeamCount,
      teamCount: groups.length,
      speedRunMinutes: SPEED_RUN_MS / 60000,
    });
  } catch (error) {
    console.error("Failed to load integrity:", error);
    return NextResponse.json({ error: "Failed to load integrity." }, { status: 500 });
  }
}
