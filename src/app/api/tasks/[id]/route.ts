import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateTaskSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const raw = await req.json();
  const { data: body, error } = parseBody(updateTaskSchema, raw);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const { id } = params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await prisma.task.findUnique({ 
    where: { id },
    include: { tags: true } 
  });
  if (!current) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Only bump updatedAt for meaningful field changes, not order/position changes
  const CONTENT_FIELDS = ["title", "description", "assigneeId", "deadline", "priority"];
  const updateData: Record<string, unknown> = { ...body };

  let columnActuallyChanged = false;

  if (body.column !== undefined) {
    if (current.column !== body.column) {
      columnActuallyChanged = true;
      updateData.columnUpdatedAt = new Date();

      // Fetch column names for logging
      const [fromCol, toCol] = await Promise.all([
        prisma.column.findUnique({ where: { id: current.column } }),
        prisma.column.findUnique({ where: { id: body.column } }),
      ]);

      await recordActivity(
        id, 
        session.userId, 
        "MOVE", 
        `Moved from ${fromCol?.label || "Unknown"} to ${toCol?.label || "Unknown"}`
      );

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
      const destinationIsDone = toCol?.isDone ?? false;
      const currentIsDone = fromCol?.isDone ?? false;
 
      if (destinationIsDone && !currentIsDone) {
        const doneColumns = await prisma.column.findMany({
          where: { boardId: toCol!.boardId, isDone: true },
          select: { id: true },
        });
        const doneColumnIds = doneColumns.map((c) => c.id);
        const firstDoneEntry = await prisma.taskColumnHistory.findFirst({
          where: { taskId: id, columnId: { in: doneColumnIds } },
          orderBy: { enteredAt: "asc" },
        });
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

  await prisma.task.update({
    where: { id },
    data: updateData,
  });

  // Log other changes after update is successful
  if (body.title && body.title !== current.title) {
    await recordActivity(id, session.userId, "UPDATE", `Renamed to "${body.title}"`);
  }
  if (body.priority && body.priority !== current.priority) {
    await recordActivity(id, session.userId, "UPDATE", `Changed priority to ${body.priority}`);
  }
  if (body.description !== undefined && body.description !== current.description) {
    await recordActivity(id, session.userId, "UPDATE", "Updated the description");
  }
  if (body.assigneeId !== undefined && body.assigneeId !== current.assigneeId) {
    if (body.assigneeId) {
      const newUser = await prisma.user.findUnique({ where: { id: body.assigneeId } });
      await recordActivity(id, session.userId, "ASSIGNEE", `Assigned to ${newUser?.name || "someone"}`);
    } else {
      await recordActivity(id, session.userId, "ASSIGNEE", "Unassigned the task");
    }
  }
  if (body.tagIds !== undefined) {
    await recordActivity(id, session.userId, "TAG", "Updated tags");
  }

  // Finally, fetch the fully updated task with all activities to return
  const finalTask = await prisma.task.findUnique({
    where: { id },
    include: {
      comments: { orderBy: { createdAt: "asc" } },
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
      activities: {
        include: { user: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: "desc" }
      }
    },
  });

  return NextResponse.json(finalTask);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
