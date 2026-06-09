import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateTaskSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";

// GET single task with full details (activities, comments, etc.)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const totalStart = Date.now();
  const logPrefix = `[perf] GET /api/tasks/${id}`;

  // parse include hint: ?include=activities,comments,all
  const url = new URL(_req.url);
  const includeParam = url.searchParams.get("include");
  const includeSet = new Set((includeParam || "").split(",").map((s) => s.trim()).filter(Boolean));
  const wantAll = includeSet.has("all") || includeSet.has("full");
  const wantActivities = wantAll || includeSet.has("activities");
  const wantComments = wantAll || includeSet.has("comments");

  // Measure connection acquisition time (may be near-zero if already connected)
  const connectStart = Date.now();
  try {
    // Attempt to connect (no-op if already connected) to surface connect latency
    await prisma.$connect();
  } catch (err) {
    // ignore - $connect may error if already connected in some setups
  }
  const connectMs = Date.now() - connectStart;

  const sessionStart = Date.now();
  const session = await getSession();
  const sessionMs = Date.now() - sessionStart;
  if (!session) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, status: 401 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: ensure the requesting user is a member of the task's board
  const authStart = Date.now();
  const taskAuth = await prisma.task.findUnique({ where: { id: id }, select: { columnRel: { select: { boardId: true } } } });
  const authMs = Date.now() - authStart;
  if (!taskAuth || !taskAuth.columnRel) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, authMs, status: 404 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await isMemberOfBoard(session.userId, taskAuth.columnRel.boardId);
  if (!allowed) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, authMs, status: 403 });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build lean vs full selects. Default is lean (fast): minimal scalars + tags + assigneeUser.
  const leanSelect: any = {
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
    assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
    order: true,
    priority: true,
    movedByNonAssignee: true,
    tags: { select: { id: true, name: true, color: true } },
  };

  const detailedInclude: any = wantAll
    ? {
        comments: { orderBy: { createdAt: "asc" } },
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        tags: true,
        activities: {
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      }
    : undefined;

  // If only activities are requested, include activities only (plus minimal scalars)
  const activityInclude: any = wantActivities && !wantAll
    ? {
        activities: {
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      }
    : undefined;

  // If only comments are requested
  const commentsInclude: any = wantComments && !wantAll
    ? { comments: { orderBy: { createdAt: "asc" } } }
    : undefined;

  // Fetch the main task row with a lean select (no nested activities/comments by default)
  const taskQueryStart = Date.now();
  const task = await prisma.task.findUnique({ where: { id: id }, select: leanSelect });
  const taskQueryMs = Date.now() - taskQueryStart;

  if (!task) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, taskQueryMs, status: 404 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If activities or comments were requested, fetch them using targeted queries.
  let activities: any[] = [];
  let activitiesMs = 0;
  let comments: any[] = [];
  let commentsMs = 0;

  if (wantActivities) {
    const activitiesStart = Date.now();
    // fetch only the small set of fields the UI renders; include minimal user info
    activities = await prisma.taskActivity.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        userId: true,
        user: { select: { id: true, name: true, color: true, handle: true } },
      },
    });
    activitiesMs = Date.now() - activitiesStart;
    task.activities = activities;
  }

  if (wantComments) {
    const commentsStart = Date.now();
    comments = await prisma.comment.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } , select: { id: true, content: true, author: true, createdAt: true, taskId: true } });
    commentsMs = Date.now() - commentsStart;
    task.comments = comments;
  }

  const queryMs = taskQueryMs + activitiesMs + commentsMs;

  // Measure serialization cost explicitly (JSON.stringify)
  const serializeStart = Date.now();
  const bodyString = JSON.stringify(task);
  const serializeMs = Date.now() - serializeStart;

  const totalMs = Date.now() - totalStart;
  if (process.env.NODE_ENV !== "production") {
    console.info(logPrefix, { totalMs, connectMs, sessionMs, queryMs, serializeMs, includeParam, timestamp: new Date().toISOString() });
  }

  return new NextResponse(bodyString, { headers: { "Content-Type": "application/json" } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const raw = await req.json();
  const result = parseBody(updateTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const body = result.data;
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorize: ensure the user is a member of the board this task belongs to
  const taskAuth = await prisma.task.findUnique({ where: { id }, select: { columnRel: { select: { boardId: true } } } });
  if (!taskAuth || !taskAuth.columnRel) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const allowed = await isMemberOfBoard(session.userId, taskAuth.columnRel.boardId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Validate that any assignee/tags are scoped to this task's board — prevents
  // assigning to a non-member or attaching another board's tags. Null assignee
  // (unassign) and empty tagIds (clear) are intentionally allowed.
  const boardId = taskAuth.columnRel.boardId;
  if (body.assigneeId) {
    const assigneeMember = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: body.assigneeId, boardId } },
      select: { id: true },
    });
    if (!assigneeMember) {
      return NextResponse.json({ error: "Assignee is not a member of this board." }, { status: 400 });
    }
  }
  if (body.tagIds?.length) {
    const validTags = await prisma.tag.findMany({
      where: { id: { in: body.tagIds }, boardId },
      select: { id: true },
    });
    if (validTags.length !== body.tagIds.length) {
      return NextResponse.json({ error: "One or more tags do not belong to this board." }, { status: 400 });
    }
  }

  const totalStart = Date.now();

  // measure connect + session acquisition
  const connectStart = Date.now();
  try {
    await prisma.$connect();
  } catch (err) {
    // ignore
  }
  const connectMs = Date.now() - connectStart;
  // Determine whether we need to pre-load the current task row to compute diffs.
  const needCurrent = body.tagIds !== undefined || body.column !== undefined;

  let current: any = null;
  let findMs = 0;
  if (needCurrent) {
    // Fetch only the fields we need to determine diffs (keep payload small).
    // IMPORTANT: only fetch `tags` when `tagIds` are being updated to avoid an unnecessary relation read.
    const selectForCurrent: any = {
      id: true,
      title: true,
      description: true,
      column: true,
      assigneeId: true,
      priority: true,
      order: true,
      completedAt: true,
    };
    if (body.tagIds !== undefined) {
      // only need ids to compute connect/disconnect diffs
      selectForCurrent.tags = { select: { id: true } };
    }

    const findStart = Date.now();
    current = (await prisma.task.findUnique({ where: { id }, select: selectForCurrent })) as any;
    findMs = Date.now() - findStart;
    if (!current) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  // Only bump updatedAt for meaningful field changes, not order/position changes
  const CONTENT_FIELDS = ["title", "description", "assigneeId", "deadline", "priority"];
  const updateData: Record<string, unknown> = { ...body };

  // Integrity signals (movedByNonAssignee) only make sense for class group boards.
  // Never record them on personal/standalone boards.
  if (updateData.movedByNonAssignee) {
    const isGroupBoard = await prisma.group.findUnique({
      where: { boardId: taskAuth.columnRel.boardId },
      select: { id: true },
    });
    if (!isGroupBoard) delete updateData.movedByNonAssignee;
  }

  let columnActuallyChanged = false;

  if (body.column !== undefined) {
    if (current.column !== body.column) {
      // Verify destination column exists and belongs to a board the user can access
      try {
        const destCol = await prisma.column.findUnique({ where: { id: body.column }, select: { boardId: true } });
        if (!destCol) return NextResponse.json({ error: "Destination column not found" }, { status: 400 });
        const destAllowed = await isMemberOfBoard(session.userId, destCol.boardId);
        if (!destAllowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } catch (err) {
        console.error("Failed to validate destination column membership:", err);
        return NextResponse.json({ error: "Failed to validate destination" }, { status: 500 });
      }
      columnActuallyChanged = true;
      updateData.columnUpdatedAt = new Date();

      // Perform non-critical history and completion work in background so scalar updates stay fast.
      (async () => {
        const now = new Date();
        const targetColumnId = body.column as string;
        try {
          await prisma.taskColumnHistory.updateMany({
            where: { taskId: id, exitedAt: null },
            data: { exitedAt: now },
          });
          await prisma.taskColumnHistory.create({
            data: { taskId: id, columnId: targetColumnId, enteredAt: now },
          });

          // Determine destination/previous done status and apply completion changes if needed (background)
          const [fromCol, toCol] = await Promise.all([
            prisma.column.findUnique({ where: { id: current.column }, select: { id: true, label: true, isDone: true, boardId: true } }),
            prisma.column.findUnique({ where: { id: targetColumnId }, select: { id: true, label: true, isDone: true, boardId: true } }),
          ]);

          const destinationIsDone = toCol?.isDone ?? false;
          const currentIsDone = fromCol?.isDone ?? false;

          if (destinationIsDone && !currentIsDone) {
            await prisma.task.update({ where: { id }, data: { completedAt: now } });
            void recordActivity(id, session.userId, "COMPLETE", `Completed in ${toCol?.label}`);
          } else if (!destinationIsDone && currentIsDone) {
            await prisma.task.update({ where: { id }, data: { completedAt: null } });
            void recordActivity(id, session.userId, "REOPEN", `Reopened and moved to ${toCol?.label}`);
          } else {
            void recordActivity(id, session.userId, "MOVE", `Moved from ${fromCol?.label || "Unknown"} to ${toCol?.label || "Unknown"}`);
          }
        } catch (err) {
          console.error("Failed to update taskColumnHistory (background):", err);
        }
      })();
    }
  }

  let tagOps: any = null;
  if (body.tagIds !== undefined) {
    // compute connect/disconnect diffs instead of replacing the whole relation
    const currentTagIds = (current?.tags ?? []).map((t: any) => t.id);
    const requestedTagIds = body.tagIds as string[];
    const toConnect = requestedTagIds.filter((tid: string) => !currentTagIds.includes(tid));
    const toDisconnect = currentTagIds.filter((tid: string) => !requestedTagIds.includes(tid));
    if (toConnect.length || toDisconnect.length) {
      tagOps = {};
      if (toConnect.length) tagOps.connect = toConnect.map((id: string) => ({ id }));
      if (toDisconnect.length) tagOps.disconnect = toDisconnect.map((id: string) => ({ id }));
    }
    delete updateData.tagIds;
  }

  const hasContentChange = CONTENT_FIELDS.some((f) => f in body);
  if (hasContentChange || columnActuallyChanged) {
    updateData.updatedAt = new Date();
  }


  // Apply tag connect/disconnect ops if present
  if (tagOps) {
    updateData.tags = tagOps;
  }

  // Fast-path: if we do not need the current row (no tag/column diffs), skip the initial findUnique
  // and perform a direct, minimal update. This avoids an extra read for common scalar updates.
  let updated: any;
  let updateMs = 0;
  if (!needCurrent) {
    const updateStart = Date.now();
    updated = await prisma.task.update({
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
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        order: true,
        priority: true,
        movedByNonAssignee: true,
        tags: { select: { id: true, name: true, color: true } },
      },
    });
    updateMs = Date.now() - updateStart;

    // Fire-and-forget lightweight post-update work (no diffs available here)
    (async () => {
      const postUpdateWork: Promise<unknown>[] = [];
      if (body.title) postUpdateWork.push(recordActivity(id, session.userId, "UPDATE", `Renamed to "${body.title}"`));
      if (body.priority) postUpdateWork.push(recordActivity(id, session.userId, "UPDATE", `Changed priority to ${body.priority}`));
      if (body.description !== undefined) {
        postUpdateWork.push(prisma.taskDescriptionVersion.create({ data: { taskId: id, userId: session.userId, content: body.description } }));
        postUpdateWork.push(recordActivity(id, session.userId, "UPDATE", "Updated the description"));
      }
      if (body.assigneeId !== undefined) postUpdateWork.push(recordActivity(id, session.userId, "ASSIGNEE", "Changed assignee"));
      if (body.tagIds !== undefined) postUpdateWork.push(recordActivity(id, session.userId, "TAG", "Updated tags"));
      try {
        await Promise.allSettled(postUpdateWork);
      } catch (err) {
        console.error("Post-update background work failed:", err);
      }
    })();
  } else {
    const updateStart = Date.now();
    updated = await prisma.task.update({
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
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        order: true,
        priority: true,
        movedByNonAssignee: true,
        tags: { select: { id: true, name: true, color: true } },
      },
    });
    updateMs = Date.now() - updateStart;

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
  }



  // Compose a minimal response; ensure `tags`, `comments`, and `activities` are present so
  // client code can safely replace local task objects without structural surprises.
  const response = {
    ...updated,
    tags: updated.tags ?? [],
    comments: [],
    activities: [],
  };

  // measure serialization cost explicitly
  const serializeStart = Date.now();
  const bodyString = JSON.stringify(response);
  const serializeMs = Date.now() - serializeStart;

  const totalMs = Date.now() - totalStart;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[perf] PATCH /api/tasks/${id}`, { totalMs, connectMs, findMs, updateMs, serializeMs, timestamp: new Date().toISOString() });
  }

  // Fetch the board's cryptographic channel secret to broadcast the update securely
  // We do this asynchronously so it doesn't block the API response
  prisma.board.findUnique({
    where: { id: taskAuth.columnRel.boardId },
    select: { realtimeSecret: true }
  }).then((board) => {
    if (board?.realtimeSecret) {
      broadcastToBoard(board.realtimeSecret, { type: "task:update", task: response });
    }
  }).catch((err) => console.error("Failed to fetch realtimeSecret for broadcast:", err));

  return new NextResponse(bodyString, { headers: { "Content-Type": "application/json" } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure the task exists and belongs to a board the user can access
    const taskAuth = await prisma.task.findUnique({ where: { id: id }, select: { columnRel: { select: { boardId: true } } } });
    if (!taskAuth || !taskAuth.columnRel) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed = await isMemberOfBoard(session.userId, taskAuth.columnRel.boardId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.task.delete({ where: { id: id } });

    // Fetch the board's cryptographic channel secret to broadcast the deletion
    prisma.board.findUnique({
      where: { id: taskAuth.columnRel.boardId },
      select: { realtimeSecret: true }
    }).then((board) => {
      if (board?.realtimeSecret) {
        broadcastToBoard(board.realtimeSecret, { type: "task:delete", taskId: id });
      }
    }).catch((err) => console.error("Failed to fetch realtimeSecret for broadcast:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
