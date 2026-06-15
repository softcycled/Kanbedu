import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createTaskSchema, parseBody, parseJsonBody } from "@/lib/validations";
import { getSession, getVerifiedSession, isMemberOfBoard } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";
import { getBoardNameOverrides } from "@/lib/classNames";
import { checkRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const bulkReorderSchema = z.array(z.object({ id: z.string(), order: z.number() }));

// PUT /api/tasks — bulk update task order values
export async function PUT(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const parsed = await parseJsonBody(req);
  if (parsed.error) return parsed.error;
  const raw = parsed.data;
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
    select: { id: true, columnRel: { select: { boardId: true } } },
  });
  const validTaskIds = new Set(validTasks.map((t) => t.id));
  const taskBoardMap = new Map(validTasks.map((t) => [t.id, t.columnRel.boardId]));

  const validUpdates = result.data.filter(({ id }) => validTaskIds.has(id));

  await prisma.$transaction(
    validUpdates.map(({ id, order }) => prisma.task.update({ where: { id }, data: { order } }))
  );

  // Group updates by board and broadcast surgical reorder payload to each
  const updatesByBoard = new Map<string, { id: string; order: number }[]>();
  for (const { id, order } of validUpdates) {
    const boardId = taskBoardMap.get(id)!;
    const arr = updatesByBoard.get(boardId) ?? [];
    arr.push({ id, order });
    updatesByBoard.set(boardId, arr);
  }
  const affectedBoards = await prisma.board.findMany({
    where: { id: { in: [...updatesByBoard.keys()] } },
    select: { id: true, realtimeSecret: true },
  });
  try {
    await Promise.all(
      affectedBoards.map(async (board) => {
        const updates = updatesByBoard.get(board.id) ?? [];
        if (board.realtimeSecret && updates.length > 0) {
          await broadcastToBoard(board.realtimeSecret, { type: "task:reorder", updates });
        }
      })
    );
  } catch (err) {
    console.error("Broadcast failed:", err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const session = await getVerifiedSession();
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
  const parsedTake = takeRaw ? parseInt(takeRaw, 10) : null;
  const parsedSkip = skipRaw ? parseInt(skipRaw, 10) : null;
  if (parsedTake !== null && (isNaN(parsedTake) || parsedTake < 0)) {
    return NextResponse.json({ error: "Invalid take parameter." }, { status: 400 });
  }
  if (parsedSkip !== null && (isNaN(parsedSkip) || parsedSkip < 0)) {
    return NextResponse.json({ error: "Invalid skip parameter." }, { status: 400 });
  }
  const take = parsedTake === 0 ? undefined : (parsedTake !== null ? Math.min(parsedTake, 1000) : 100);
  const skip = parsedSkip !== null ? parsedSkip : 0;

  const where = { columnRel: { boardId } };
  const [tasks, total, nameOverrides] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        _count: { select: { comments: true } },
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        assignees: {
          orderBy: { assignedAt: "asc" },
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
        },
        tags: true,
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      ...(take !== undefined ? { take, skip } : {}),
    }),
    prisma.task.count({ where }),
    getBoardNameOverrides(boardId),
  ]);

  // Return lean payload for board/list: do not include full comment bodies here.
  // Class group boards show educator-set roster names instead of self-chosen ones.
  const mapped = tasks.map((t) => ({
    ...t,
    assigneeUser: t.assigneeUser
      ? { ...t.assigneeUser, name: nameOverrides.get(t.assigneeUser.id) ?? t.assigneeUser.name }
      : t.assigneeUser,
    // flatten junction rows to plain user objects for the UI
    assignees: t.assignees.map((a) => ({
      ...a.user,
      name: nameOverrides.get(a.user.id) ?? a.user.name,
    })),
    // preserve shape expected by UI but keep comments empty to avoid payload bloat
    comments: [],
    // expose a compact comment count
    commentCount: (t as any)._count?.comments ?? 0,
  }));

  return NextResponse.json({ tasks: mapped, total });
}

export async function POST(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
  if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const parsed = await parseJsonBody(req);
  if (parsed.error) return parsed.error;
  const raw = parsed.data;
  const result = parseBody(createTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  // Profile start
  const start = Date.now();

  // Find last order in column and destination column (parallel).
  // Include realtimeSecret here to avoid an extra board lookup when broadcasting.
  const [lastTask, destinationColumn] = await Promise.all([
    prisma.task.findFirst({ where: { column: data.column }, orderBy: { order: "desc" } }),
    prisma.column.findUnique({
      where: { id: data.column },
      include: { board: { select: { realtimeSecret: true } } },
    }),
  ]);

  // Validate destination column and membership
  if (!destinationColumn) {
    return NextResponse.json({ error: "Invalid column" }, { status: 400 });
  }
  const allowed = await isMemberOfBoard(session.userId, destinationColumn.boardId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve the assignee set: assigneeIds (multi) wins over legacy assigneeId.
  // Validate every assignee is a board member and that any tags belong to this
  // board — prevents assigning to a non-member or attaching another board's tags.
  const assigneeIds = [...new Set(data.assigneeIds ?? (data.assigneeId ? [data.assigneeId] : []))];
  if (assigneeIds.length > 0) {
    const assigneeMembers = await prisma.boardMember.findMany({
      where: { userId: { in: assigneeIds }, boardId: destinationColumn.boardId },
      select: { userId: true },
    });
    if (assigneeMembers.length !== assigneeIds.length) {
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
  // Create the task but avoid heavy includes (comments/activities) — return minimal fields quickly.
  // assigneeId mirrors the first assignee; the junction rows hold the full set.
  const created = await prisma.task.create({
    data: {
      title: data.title,
      column: data.column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: now,
      completedAt: destinationColumn?.isDone ? now : null,
      ...(data.description ? { description: data.description } : {}),
      ...(assigneeIds.length > 0 ? { assigneeId: assigneeIds[0] } : {}),
      ...(assigneeIds.length > 0
        ? { assignees: { create: assigneeIds.map((userId) => ({ userId })) } }
        : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
      ...(data.tagIds?.length ? { tags: { connect: data.tagIds.map((id) => ({ id })) } } : {}),
    },
    include: {
      tags: true,
      assignees: { include: { user: { select: { id: true, name: true, color: true, handle: true } } } },
    },
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

  // Flatten junction rows to user objects; class group boards show roster names.
  const createNameOverrides =
    created.assignees.length > 0 ? await getBoardNameOverrides(destinationColumn.boardId) : new Map<string, string>();
  const createdAssignees = created.assignees.map((a) => ({
    ...a.user,
    name: createNameOverrides.get(a.user.id) ?? a.user.name,
  }));

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
    assigneeUser: createdAssignees[0] ?? null,
    assignees: createdAssignees,
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

  // Broadcast task creation using the realtimeSecret already fetched with the column.
  try {
    const realtimeSecret = (destinationColumn as any).board?.realtimeSecret;
    if (realtimeSecret) {
      await broadcastToBoard(realtimeSecret, { type: "task:create", task: responseTask });
    }
  } catch (err) {
    console.error("Broadcast failed:", err);
  }

  return NextResponse.json(responseTask);
}
