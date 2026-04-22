import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  // If moving to a new column, update columnUpdatedAt
  const updateData: Record<string, unknown> = { ...body };
  if (body.column !== undefined) {
    const current = await prisma.task.findUnique({ where: { id } });
    if (current && current.column !== body.column) {
      updateData.columnUpdatedAt = new Date();
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
