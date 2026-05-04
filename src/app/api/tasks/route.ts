import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
    include: { comments: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ column: "asc" }, { order: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const { title, column } = await req.json();

  const [lastTask, destinationColumn] = await Promise.all([
    prisma.task.findFirst({ where: { column }, orderBy: { order: "desc" } }),
    prisma.column.findUnique({ where: { id: column } }),
  ]);

  const now = new Date();
  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: now,
      // If creating directly in the Done column, mark as completed immediately.
      completedAt: destinationColumn?.isDone ? now : null,
    },
    include: { comments: true },
  });

  // Record initial column history entry
  await prisma.taskColumnHistory.create({
    data: { taskId: task.id, columnId: column, enteredAt: now },
  });

  return NextResponse.json(task);
}
