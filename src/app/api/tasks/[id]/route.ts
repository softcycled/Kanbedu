import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateTaskSchema, parseBody } from "@/lib/validations";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const raw = await req.json();
  const result = parseBody(updateTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const body = result.data;
  const { id } = params;

  // Only bump updatedAt for meaningful field changes, not order/position changes
  const CONTENT_FIELDS = ["title", "description", "assigneeId", "deadline", "priority"];
  const updateData: Record<string, unknown> = { ...body };

  let columnActuallyChanged = false;

  if (body.column !== undefined) {
    const current = await prisma.task.findUnique({ where: { id } });
    if (current && current.column !== body.column) {
      columnActuallyChanged = true;
      updateData.columnUpdatedAt = new Date();

      // Close the current open history entry, open a new one
      const now = new Date();
      await prisma.taskColumnHistory.updateMany({
        where: { taskId: id, exitedAt: null },
        data: { exitedAt: now },
      });
      await prisma.taskColumnHistory.create({
        data: { taskId: id, columnId: body.column, enteredAt: now },
      });

      // Set completion metadata when entering or leaving the Done column.
      const [destinationColumn, currentColumn] = await Promise.all([
        prisma.column.findUnique({ where: { id: body.column } }),
        prisma.column.findUnique({ where: { id: current.column } }),
      ]);
      const destinationIsDone = destinationColumn?.isDone ?? false;
      const currentIsDone = currentColumn?.isDone ?? false;

      if (destinationIsDone && !currentIsDone) {
        // If this task was previously completed (has prior history in a done column),
        // reuse the original completedAt so a misclick-and-restore doesn't corrupt
        // deadline adherence by overwriting with today's timestamp.
        const doneColumns = await prisma.column.findMany({
          where: { boardId: destinationColumn!.boardId, isDone: true },
          select: { id: true },
        });
        const doneColumnIds = doneColumns.map((c) => c.id);
        const firstDoneEntry = await prisma.taskColumnHistory.findFirst({
          where: { taskId: id, columnId: { in: doneColumnIds } },
          orderBy: { enteredAt: "asc" },
        });
        // firstDoneEntry will be the newly-created entry (enteredAt = now) if this
        // is the first time in Done, or the original entry if the task was here before.
        updateData.completedAt = firstDoneEntry?.enteredAt ?? now;
      } else if (!destinationIsDone && currentIsDone) {
        updateData.completedAt = null;
      }
    }
  }

  if (body.tagIds !== undefined) {
    updateData.tags = {
      set: body.tagIds.map((id) => ({ id })),
    };
    delete updateData.tagIds;
  }

  const hasContentChange = CONTENT_FIELDS.some((f) => f in body);
  if (hasContentChange || columnActuallyChanged) {
    updateData.updatedAt = new Date();
  }

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      comments: { orderBy: { createdAt: "asc" } },
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
    },
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
