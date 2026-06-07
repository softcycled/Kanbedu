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
    for (const g of groups) {
      let nonDone = 0;
      for (const c of g.board.columns) {
        columnInfo.set(c.id, { boardId: g.boardId, isDone: c.isDone, label: c.label });
        if (!c.isDone) nonDone++;
      }
      nonDoneCountByBoard.set(g.boardId, nonDone);
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
    }
    const flaggedByBoard = new Map<string, Flagged[]>();

    for (const t of tasks) {
      const info = columnInfo.get(t.column);
      if (!info) continue;
      const isDone = info.isDone;
      const cycleTimeMs = t.completedAt ? t.completedAt.getTime() - t.createdAt.getTime() : null;

      // Distinct non-done columns this task has passed through.
      const visitedColumnCount = new Set(
        t.columnHistory.map((h) => h.columnId).filter((cid) => {
          const ci = columnInfo.get(cid);
          return ci && !ci.isDone;
        })
      ).size;

      const totalNonDone = nonDoneCountByBoard.get(info.boardId) ?? 0;
      const isSpeedRun = isDone && cycleTimeMs !== null && cycleTimeMs < SPEED_RUN_MS;
      const isColumnSkip = isDone && totalNonDone > 1 && visitedColumnCount < totalNonDone;
      const isMovedByOther = t.movedByNonAssignee;

      if (!isSpeedRun && !isColumnSkip && !isMovedByOther) continue;

      const assignee = t.assigneeUser?.handle
        ? `@${t.assigneeUser.handle}`
        : t.assigneeUser?.name || "(unassigned)";

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
