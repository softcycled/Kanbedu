import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const tasks = await prisma.task.findMany({
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
