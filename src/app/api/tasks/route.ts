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

  const lastTask = await prisma.task.findFirst({
    where: { column },
    orderBy: { order: "desc" },
  });

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      column,
      order: (lastTask?.order ?? 0) + 1,
      columnUpdatedAt: new Date(),
    },
    include: { comments: true },
  });

  return NextResponse.json(task);
}
