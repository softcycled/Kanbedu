import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createTaskSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
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

  const cols = await prisma.column.findMany({
    where: { boardId },
    select: { id: true },
  });
  const where = { column: { in: cols.map((c) => c.id) } };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      comments: {
        select: { id: true, content: true, author: true, createdAt: true, taskId: true },
        orderBy: { createdAt: "asc" },
      },
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
      activities: {
        include: { user: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    orderBy: [{ column: "asc" }, { order: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const raw = await req.json();
  const result = parseBody(createTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  const [lastTask, destinationColumn] = await Promise.all([
    prisma.task.findFirst({ where: { column: data.column }, orderBy: { order: "desc" } }),
    prisma.column.findUnique({ where: { id: data.column } }),
  ]);

  const now = new Date();
  const task = await prisma.task.create({
    data: {
      title: data.title,
      column: data.column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: now,
      // If creating directly in the Done column, mark as completed immediately.
      completedAt: destinationColumn?.isDone ? now : null,
    },
    include: {
      comments: true,
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
      activities: {
        include: { user: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Record initial column history entry
  await prisma.taskColumnHistory.create({
    data: { taskId: task.id, columnId: data.column, enteredAt: now },
  });

  const session = await getSession();
  if (session) {
    await recordActivity(task.id, session.userId, "CREATE", "Created the task");
  }

  return NextResponse.json(task);
}
