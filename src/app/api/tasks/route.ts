import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createTaskSchema, parseBody } from "@/lib/validations";
import { z } from "zod";

const bulkReorderSchema = z.array(z.object({ id: z.string(), order: z.number() }));

// PUT /api/tasks — bulk update task order values
export async function PUT(req: Request) {
  const raw = await req.json();
  const result = bulkReorderSchema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await prisma.$transaction(
    result.data.map(({ id, order }) =>
      prisma.task.update({ where: { id }, data: { order } })
    )
  );
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");

  let where = {};
  if (boardId) {
    const cols = await prisma.column.findMany({
      where: { boardId },
      select: { id: true },
    });
    where = { column: { in: cols.map((c) => c.id) } };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      comments: { orderBy: { createdAt: "asc" } },
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
    },
  });

  // Record initial column history entry
  await prisma.taskColumnHistory.create({
    data: { taskId: task.id, columnId: data.column, enteredAt: now },
  });

  return NextResponse.json(task);
}
