import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createTaskSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";
import { z } from "zod";

const bulkReorderSchema = z.array(z.object({ id: z.string(), order: z.number() }));

// PUT /api/tasks — bulk update task order values
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const result = bulkReorderSchema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only allow reordering tasks that belong to boards the user is a member of
  const memberships = await prisma.boardMember.findMany({
    where: { userId: session.userId },
    select: { boardId: true },
  });
  const boardIds = memberships.map((m) => m.boardId);

  const taskIds = result.data.map((t) => t.id);
  const validTasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, columnRel: { boardId: { in: boardIds } } },
    select: { id: true },
  });
  const validTaskIds = new Set(validTasks.map((t) => t.id));

  await prisma.$transaction(
    result.data
      .filter(({ id }) => validTaskIds.has(id))
      .map(({ id, order }) => prisma.task.update({ where: { id }, data: { order } }))
  );

  // Broadcast refresh to all affected boards
  const affectedBoards = await prisma.board.findMany({
    where: { id: { in: boardIds } },
    select: { realtimeSecret: true },
  });
  affectedBoards.forEach((board) => {
    if (board.realtimeSecret) broadcastToBoard(board.realtimeSecret);
  });

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");

  if (!boardId) {
    return NextResponse.json({ error: "boardId is required" }, { status: 400 });
  }

  // Verify user is a member of the requested board
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.userId, boardId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  // take=0 means no limit; omitted defaults to 100
  const take = takeRaw === "0" ? undefined : (takeRaw ? Math.max(1, parseInt(takeRaw, 10)) : 100);
  const skip = skipRaw ? Math.max(0, parseInt(skipRaw, 10)) : 0;

  const where = { columnRel: { boardId } };
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        _count: { select: { comments: true } },
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        tags: true,
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      ...(take !== undefined ? { take, skip } : {}),
    }),
    prisma.task.count({ where }),
  ]);

  // Return lean payload for board/list: do not include full comment bodies here.
  const mapped = tasks.map((t) => ({
    ...t,
    // preserve shape expected by UI but keep comments empty to avoid payload bloat
    comments: [],
    // expose a compact comment count
    commentCount: (t as any)._count?.comments ?? 0,
  }));

  return NextResponse.json({ tasks: mapped, total });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const result = parseBody(createTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  // Profile start
  const start = Date.now();

  // Find last order in column and destination column (parallel)
  const [lastTask, destinationColumn] = await Promise.all([
    prisma.task.findFirst({ where: { column: data.column }, orderBy: { order: "desc" } }),
    prisma.column.findUnique({ where: { id: data.column } }),
  ]);

  // Validate destination column and membership
  if (!destinationColumn) {
    return NextResponse.json({ error: "Invalid column" }, { status: 400 });
  }
  const allowed = await isMemberOfBoard(session.userId, destinationColumn.boardId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate that the assignee (if any) is a member of this board and that any
  // tags belong to it — prevents assigning to a non-member or attaching another
  // board's tags.
  if (data.assigneeId) {
    const assigneeMember = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: data.assigneeId, boardId: destinationColumn.boardId } },
      select: { id: true },
    });
    if (!assigneeMember) {
      return NextResponse.json({ error: "Assignee is not a member of this board." }, { status: 400 });
    }
  }
  if (data.tagIds?.length) {
    const validTags = await prisma.tag.findMany({
      where: { id: { in: data.tagIds }, boardId: destinationColumn.boardId },
      select: { id: true },
    });
    if (validTags.length !== data.tagIds.length) {
      return NextResponse.json({ error: "One or more tags do not belong to this board." }, { status: 400 });
    }
  }

  const now = new Date();
  // Create the task but avoid heavy includes (comments/activities) — return minimal fields quickly
  const created = await prisma.task.create({
    data: {
      title: data.title,
      column: data.column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: now,
      completedAt: destinationColumn?.isDone ? now : null,
      ...(data.description ? { description: data.description } : {}),
      ...(data.assigneeId ? { assigneeId: data.assigneeId } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
      ...(data.tagIds?.length ? { tags: { connect: data.tagIds.map((id) => ({ id })) } } : {}),
    },
    include: { tags: true },
  });

  // Fire-and-forget non-critical work: history and activity logging
  (async () => {
    try {
      await prisma.taskColumnHistory.create({
        data: { taskId: created.id, columnId: data.column, enteredAt: now },
      });
    } catch (err) {
      console.error("Failed to create taskColumnHistory (background):", err);
    }

    try {
      await recordActivity(created.id, session.userId, "CREATE", "Created the task");
    } catch (err) {
      console.error("Failed to record activity (background):", err);
    }
  })();

  // Minimal response payload for fast client update
  const responseTask = {
    id: created.id,
    title: created.title,
    description: created.description ?? "",
    deadline: created.deadline ?? null,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    completedAt: created.completedAt ?? null,
    column: created.column,
    columnUpdatedAt: created.columnUpdatedAt,
    assigneeId: created.assigneeId ?? null,
    order: created.order,
    priority: created.priority,
    movedByNonAssignee: created.movedByNonAssignee ?? false,
    comments: [],
    tags: created.tags ?? [],
    activities: [],
  };

  if (process.env.NODE_ENV !== "production") {
    console.info(`[perf] POST /api/tasks total ${Date.now() - start}ms`);
  }

  // Broadcast task creation securely using the board's realtimeSecret
  prisma.board.findUnique({
    where: { id: destinationColumn.boardId },
    select: { realtimeSecret: true }
  }).then((board) => {
    if (board?.realtimeSecret) {
      broadcastToBoard(board.realtimeSecret, { type: "task:create", task: responseTask });
    }
  }).catch((err) => console.error("Failed to fetch realtimeSecret for broadcast:", err));

  return NextResponse.json(responseTask);
}
