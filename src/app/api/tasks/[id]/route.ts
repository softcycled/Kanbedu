import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateTaskSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

// GET single task with full details (activities, comments, etc.)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      comments: { orderBy: { createdAt: "asc" } },
      assigneeUser: { select: { id: true, name: true, color: true } },
      tags: true,
      activities: {
        include: { user: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  // Fetch only the fields we need to determine diffs (keep payload small)
  const current = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      column: true,
      assigneeId: true,
      priority: true,
      order: true,
      completedAt: true,
      tags: { select: { id: true, name: true, color: true } },
    },
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
      // Close history and create a new entry — do non-critical work in background
      const now = new Date();
      const targetColumnId = body.column as string;
      (async () => {
        try {
          await prisma.taskColumnHistory.updateMany({
            where: { taskId: id, exitedAt: null },
            data: { exitedAt: now },
          });
          await prisma.taskColumnHistory.create({
            data: { taskId: id, columnId: targetColumnId, enteredAt: now },
          });
        } catch (err) {
          console.error("Failed to update taskColumnHistory (background):", err);
        }
      })();

      // Set simple completion metadata immediately to avoid blocking — compute exact historical first-entry later if needed
      // Determine destination/previous done status with light queries
      const [fromCol, toCol] = await Promise.all([
        prisma.column.findUnique({ where: { id: current.column }, select: { id: true, label: true, isDone: true, boardId: true } }),
        prisma.column.findUnique({ where: { id: body.column }, select: { id: true, label: true, isDone: true, boardId: true } }),
      ]);

      const destinationIsDone = toCol?.isDone ?? false;
      const currentIsDone = fromCol?.isDone ?? false;

      if (destinationIsDone && !currentIsDone) {
        updateData.completedAt = now;
        // background activity
        void recordActivity(id, session.userId, "COMPLETE", `Completed in ${toCol?.label}`);
      } else if (!destinationIsDone && currentIsDone) {
        updateData.completedAt = null;
        void recordActivity(id, session.userId, "REOPEN", `Reopened and moved to ${toCol?.label}`);
      } else {
        // Record a move activity in background
        void recordActivity(id, session.userId, "MOVE", `Moved from ${fromCol?.label || "Unknown"} to ${toCol?.label || "Unknown"}`);
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


  // Perform the update and return a minimal updated task in one call
  const updated = await prisma.task.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      column: true,
      columnUpdatedAt: true,
      assigneeId: true,
      order: true,
      priority: true,
      movedByNonAssignee: true,
      // return tags from the earlier `current` snapshot to avoid extra fetch
    },
  });

  // Fire-and-forget post-update work (activities, description versions, assignee lookups)
  (async () => {
    const postUpdateWork: Promise<unknown>[] = [];

    if (body.title && body.title !== current.title) {
      postUpdateWork.push(recordActivity(id, session.userId, "UPDATE", `Renamed to "${body.title}"`));
    }
    if (body.priority && body.priority !== current.priority) {
      postUpdateWork.push(recordActivity(id, session.userId, "UPDATE", `Changed priority to ${body.priority}`));
    }
    if (body.description !== undefined && body.description !== current.description) {
      postUpdateWork.push(
        prisma.taskDescriptionVersion.create({
          data: { taskId: id, userId: session.userId, content: body.description },
        }),
        recordActivity(id, session.userId, "UPDATE", "Updated the description")
      );
    }
    if (body.assigneeId !== undefined && body.assigneeId !== current.assigneeId) {
      if (body.assigneeId) {
        postUpdateWork.push(
          prisma.user.findUnique({ where: { id: body.assigneeId } }).then((newUser) =>
            recordActivity(id, session.userId, "ASSIGNEE", `Assigned to ${newUser?.name || "someone"}`)
          )
        );
      } else {
        postUpdateWork.push(recordActivity(id, session.userId, "ASSIGNEE", "Unassigned the task"));
      }
    }
    if (body.tagIds !== undefined) {
      postUpdateWork.push(recordActivity(id, session.userId, "TAG", "Updated tags"));
    }

    try {
      await Promise.allSettled(postUpdateWork);
    } catch (err) {
      console.error("Post-update background work failed:", err);
    }
  })();

  // Compose a minimal response including previous tags snapshot
  const response = {
    ...updated,
    tags: current.tags ?? [],
    comments: [],
    activities: [],
  };

  if (process.env.NODE_ENV !== "production") {
    console.info(`[perf] PATCH /api/tasks/${id} total ${Date.now() - start}ms`);
  }

  return NextResponse.json(response);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
