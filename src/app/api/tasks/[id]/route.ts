import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  // Only bump updatedAt for meaningful field changes, not order/position changes
  const CONTENT_FIELDS = ["title", "description", "assignee", "deadline"];
  const updateData: Record<string, unknown> = { ...body };

  let columnActuallyChanged = false;

  if (body.column !== undefined) {
    const current = await prisma.task.findUnique({ where: { id } });
    if (current && current.column !== body.column) {
      columnActuallyChanged = true;
      updateData.columnUpdatedAt = new Date();

      // Set completion metadata when entering or leaving the Done column.
      const destinationColumn = await prisma.column.findUnique({
        where: { id: body.column },
      });
      const destinationIsDone = destinationColumn?.isDone ?? false;
      const currentColumn = await prisma.column.findUnique({
        where: { id: current.column },
      });
      const currentIsDone = currentColumn?.isDone ?? false;

      if (destinationIsDone && !currentIsDone) {
        updateData.completedAt = new Date();
      } else if (!destinationIsDone && currentIsDone) {
        updateData.completedAt = null;
      }
    }
  }

  const hasContentChange = CONTENT_FIELDS.some((f) => f in body);
  if (hasContentChange || columnActuallyChanged) {
    updateData.updatedAt = new Date();
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
