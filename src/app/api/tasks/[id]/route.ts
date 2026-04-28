import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  // Only bump updatedAt for meaningful field changes, not order/position changes
  const MEANINGFUL_FIELDS = ["title", "description", "assignee", "deadline", "column"];
  const hasMeaningfulChange = MEANINGFUL_FIELDS.some((f) => f in body);

  // If moving to a new column, update columnUpdatedAt
  const updateData: Record<string, unknown> = { ...body };
  if (hasMeaningfulChange) {
    updateData.updatedAt = new Date();
  }
  if (body.column !== undefined) {
    const current = await prisma.task.findUnique({ where: { id } });
    if (current && current.column !== body.column) {
      updateData.columnUpdatedAt = new Date();

      // Set completion metadata when entering or leaving the Done column.
      const destinationColumn = await prisma.column.findUnique({
        where: { id: body.column },
      });
      const destinationIsDone = destinationColumn?.label.toLowerCase() === "done";
      const currentColumn = await prisma.column.findUnique({
        where: { id: current.column },
      });
      const currentIsDone = currentColumn?.label.toLowerCase() === "done";

      if (destinationIsDone && !currentIsDone) {
        updateData.completedAt = new Date();
      } else if (!destinationIsDone && currentIsDone) {
        updateData.completedAt = null;
      }
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
