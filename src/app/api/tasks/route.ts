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

  const tasks = await prisma.task.findMany({
    where: { columnRel: { boardId } },
    include: {
      comments: {
        select: { id: true, content: true, author: true, createdAt: true, taskId: true },
        orderBy: { createdAt: "asc" },
      },
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
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

  // Profile start
  const start = Date.now();

  // Find last order in column and destination column (parallel)
  const [lastTask, destinationColumn] = await Promise.all([
    prisma.task.findFirst({ where: { column: data.column }, orderBy: { order: "desc" } }),
    prisma.column.findUnique({ where: { id: data.column } }),
  ]);

  const now = new Date();
  // Create the task but avoid heavy includes (comments/activities) — return minimal fields quickly
  const created = await prisma.task.create({
    data: {
      title: data.title,
      column: data.column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: now,
      completedAt: destinationColumn?.isDone ? now : null,
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
      const session = await getSession();
      if (session) {
        await recordActivity(created.id, session.userId, "CREATE", "Created the task");
      }
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
    tags: [],
    activities: [],
  };

  if (process.env.NODE_ENV !== "production") {
    console.info(`[perf] POST /api/tasks total ${Date.now() - start}ms`);
  }

  return NextResponse.json(responseTask);
}
