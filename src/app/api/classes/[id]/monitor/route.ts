import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getVerifiedSession, getClassRole } from "@/lib/auth";

// A task is "stalled" if it has sat in a non-done column without movement for
// this many days. Surfaced as a help signal, never as a ranking.
const STALL_DAYS = 3;

// GET: per-group progress snapshot for the educator Monitor overview.
// Intentionally returns each group's OWN progress only — no cross-group ranking.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can view the monitor." }, { status: 403 });
    }

    const groups = await prisma.group.findMany({
      where: { classId: id },
      orderBy: { order: "asc" },
      include: {
        board: { include: { columns: { orderBy: { order: "asc" } } } },
        members: {
          include: { user: { select: { id: true, name: true, handle: true, color: true } } },
        },
      },
    });

    // Board has no direct tasks relation — tasks hang off columns. Fetch all
    // tasks across every group board in one query, then bucket by column id.
    const allColumnIds = groups.flatMap((g) => g.board.columns.map((c) => c.id));
    const allTasks =
      allColumnIds.length === 0
        ? []
        : await prisma.task.findMany({
            where: { column: { in: allColumnIds } },
            select: { column: true, deadline: true, completedAt: true, columnUpdatedAt: true, createdAt: true },
          });
    const tasksByColumn = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const bucket = tasksByColumn.get(t.column) ?? [];
      bucket.push(t);
      tasksByColumn.set(t.column, bucket);
    }

    const now = Date.now();
    const stallMs = STALL_DAYS * 24 * 60 * 60 * 1000;

    const result = groups.map((g) => {
      const columns = g.board.columns;
      const doneColumnIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id));
      const tasks = columns.flatMap((c) => tasksByColumn.get(c.id) ?? []);

      const total = tasks.length;
      let done = 0;
      let stalled = 0;
      let overdue = 0;
      const perColumnMap = new Map<string, number>();

      for (const t of tasks) {
        perColumnMap.set(t.column, (perColumnMap.get(t.column) ?? 0) + 1);
        const isDone = doneColumnIds.has(t.column);
        if (isDone) {
          done++;
          continue;
        }
        // Not in a done column: candidate for help signals.
        if (t.deadline && t.deadline.getTime() < now) overdue++;
        const neverMoved = t.columnUpdatedAt.getTime() === t.createdAt.getTime();
        if (!neverMoved && now - t.columnUpdatedAt.getTime() > stallMs) stalled++;
      }

      const perColumn = columns.map((c) => ({
        label: c.label,
        isDone: c.isDone,
        count: perColumnMap.get(c.id) ?? 0,
      }));

      return {
        groupId: g.id,
        name: g.name,
        boardId: g.boardId,
        realtimeSecret: g.board.realtimeSecret ?? null,
        total,
        done,
        percent: total === 0 ? 0 : Math.round((done / total) * 100),
        stalled,
        overdue,
        needsAttention: stalled > 0 || overdue > 0,
        perColumn,
        members: g.members.map((m) => ({
          id: m.user.id,
          // Educator-set roster name wins over the student's self-chosen name
          name: m.displayName ?? m.user.name,
          handle: m.user.handle,
          color: m.user.color,
        })),
      };
    });

    return NextResponse.json({ groups: result, stallDays: STALL_DAYS });
  } catch (error) {
    console.error("Failed to load monitor:", error);
    return NextResponse.json({ error: "Failed to load monitor." }, { status: 500 });
  }
}
