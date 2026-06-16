import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { updateTaskSchema, parseBody, parseJsonBody } from "@/lib/validations";
import { getSession, getVerifiedSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";
import { checkRateLimit } from "@/lib/rateLimit";
import { getBoardNameOverrides } from "@/lib/classNames";

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
  const session = await getVerifiedSession();
  const sessionMs = Date.now() - sessionStart;
  if (!session) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, status: 401 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: ensure the requesting user is a member of the task's board
  const authStart = Date.now();
  const taskAuth = await prisma.task.findUnique({
    where: { id: id },
    select: {
      columnRel: {
        select: {
          boardId: true,
          board: {
            select: {
              members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  const authMs = Date.now() - authStart;
  if (!taskAuth || !taskAuth.columnRel) {
    if (process.env.NODE_ENV !== "production") console.info(logPrefix, { totalMs: Date.now() - totalStart, connectMs, sessionMs, authMs, status: 404 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = (taskAuth.columnRel.board?.members?.length ?? 0) > 0;
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
    assignees: {
      orderBy: { assignedAt: "asc" },
      select: { user: { select: { id: true, name: true, color: true, handle: true } } },
    },
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

  // Fetch activities, comments, and name overrides in parallel.
  const extrasStart = Date.now();
  const [activities, comments, nameOverrides] = await Promise.all([
    wantActivities
      ? prisma.taskActivity.findMany({
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
        })
      : Promise.resolve([] as any[]),
    wantComments
      ? prisma.comment.findMany({
          where: { taskId: id },
          orderBy: { createdAt: "asc" },
          select: { id: true, content: true, author: true, createdAt: true, taskId: true },
        })
      : Promise.resolve([] as any[]),
    getBoardNameOverrides(taskAuth.columnRel.boardId),
  ]);
  const extrasMs = Date.now() - extrasStart;

  if (wantActivities) (task as any).activities = activities;
  if (wantComments) (task as any).comments = comments;

  const queryMs = taskQueryMs + extrasMs;

  // Flatten assignee junction rows to plain user objects, then overlay
  // educator-set roster names (class group boards) on every name we return.
  {
    const t = task as any;
    t.assignees = (t.assignees ?? []).map((a: any) => ({
      ...a.user,
      name: nameOverrides.get(a.user.id) ?? a.user.name,
    }));
    if (t.assigneeUser) {
      t.assigneeUser.name = nameOverrides.get(t.assigneeUser.id) ?? t.assigneeUser.name;
    }
    for (const act of t.activities ?? []) {
      if (act.user) act.user.name = nameOverrides.get(act.user.id) ?? act.user.name;
    }
  }

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
  const parsed = await parseJsonBody(req);
  if (parsed.error) return parsed.error;
  const raw = parsed.data;
  const result = parseBody(updateTaskSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const body = result.data;
  const { id } = await params;
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  // Authorize: fetch boardId + membership + realtimeSecret in one query.
  const taskAuth = await prisma.task.findUnique({
    where: { id },
    select: {
      columnRel: {
        select: {
          boardId: true,
          isDone: true,
          board: {
            select: {
              realtimeSecret: true,
              members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!taskAuth || !taskAuth.columnRel) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const allowed = (taskAuth.columnRel.board?.members?.length ?? 0) > 0;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Validate that any assignee/tags are scoped to this task's board — prevents
  // assigning to a non-member or attaching another board's tags. Null assignee
  // (unassign) and empty tagIds/assigneeIds (clear) are intentionally allowed.
  // assigneeIds (multi) wins over legacy assigneeId when both are present.
  const boardId = taskAuth.columnRel.boardId;
  const assigneeSetChanged = body.assigneeIds !== undefined || body.assigneeId !== undefined;
  const newAssigneeIds: string[] | null = assigneeSetChanged
    ? [...new Set(body.assigneeIds ?? (body.assigneeId ? [body.assigneeId] : []))]
    : null;
  const [assigneeMembers, validTags] = await Promise.all([
    newAssigneeIds && newAssigneeIds.length > 0
      ? prisma.boardMember.findMany({ where: { userId: { in: newAssigneeIds }, boardId }, select: { userId: true } })
      : Promise.resolve(null),
    body.tagIds?.length
      ? prisma.tag.findMany({ where: { id: { in: body.tagIds }, boardId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (assigneeMembers !== null && assigneeMembers.length !== newAssigneeIds!.length) {
    return NextResponse.json({ error: "Assignee is not a member of this board." }, { status: 400 });
  }
  if (validTags !== null && validTags.length !== body.tagIds!.length) {
    return NextResponse.json({ error: "One or more tags do not belong to this board." }, { status: 400 });
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
      assignees: { select: { userId: true } },
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
  const CONTENT_FIELDS = ["title", "description", "assigneeId", "assigneeIds", "deadline", "priority"];
  const updateData: Record<string, unknown> = { ...body };

  // movedByNonAssignee is server-computed — reject any client-supplied value.
  delete updateData.movedByNonAssignee;

  // Assignee set change: replace junction rows atomically and mirror the first
  // assignee onto assigneeId for legacy paths. assigneeIds is not a Task column.
  delete updateData.assigneeIds;
  if (newAssigneeIds !== null) {
    updateData.assigneeId = newAssigneeIds[0] ?? null;
    updateData.assignees = {
      deleteMany: {},
      create: newAssigneeIds.map((userId) => ({ userId })),
    };
  }

  let columnActuallyChanged = false;

  if (body.column !== undefined) {
    if (current.column !== body.column) {
      // Verify destination column exists and belongs to a board the user can access
      try {
        const destCol = await prisma.column.findUnique({ where: { id: body.column }, select: { boardId: true, isDone: true } });
        if (!destCol) return NextResponse.json({ error: "Destination column not found" }, { status: 400 });
        if (destCol.boardId !== taskAuth.columnRel.boardId) {
          return NextResponse.json({ error: "Destination column must belong to the same board." }, { status: 400 });
        }
        // No separate membership check needed: destCol.boardId is the same board as taskAuth,
        // and membership was already verified in the combined auth query above.

        // Set completedAt synchronously so the PATCH response reflects the correct value immediately.
        const currentIsDone = taskAuth.columnRel.isDone ?? false;
        if (destCol.isDone && !currentIsDone) {
          updateData.completedAt = new Date();
        } else if (!destCol.isDone && currentIsDone) {
          updateData.completedAt = null;
        }
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
          const wasInDone = fromCol?.isDone ?? false;

          if (destinationIsDone && !wasInDone) {
            void recordActivity(id, session.userId, "COMPLETE", `Completed in ${toCol?.label}`);
          } else if (!destinationIsDone && wasInDone) {
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

  // Server-side integrity signal: set flag when a non-assignee moves the task to
  // a different column, but only on class group boards and only when the assignee
  // is not also changing in this same request. With multi-assignee, the mover is
  // a non-assignee only when they're in none of the task's assignee set.
  const currentAssigneeIds: string[] = (current?.assignees ?? []).map((a: any) => a.userId);
  if (currentAssigneeIds.length === 0 && current?.assigneeId) currentAssigneeIds.push(current.assigneeId);
  if (
    columnActuallyChanged &&
    currentAssigneeIds.length > 0 &&
    !currentAssigneeIds.includes(session.userId) &&
    !assigneeSetChanged
  ) {
    const isGroupBoard = await prisma.group.findFirst({
      where: { boardId: taskAuth.columnRel.boardId },
      select: { id: true },
    });
    if (isGroupBoard) updateData.movedByNonAssignee = true;
  }
  // Clear the flag when the actual assignee moves the task themselves.
  if (columnActuallyChanged && currentAssigneeIds.includes(session.userId)) {
    updateData.movedByNonAssignee = false;
  }
  // Clear the flag when the assignee set is changed — new assignees start clean.
  if (assigneeSetChanged) {
    updateData.movedByNonAssignee = false;
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
        assignees: {
          orderBy: { assignedAt: "asc" },
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
        },
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
      if (assigneeSetChanged) postUpdateWork.push(recordActivity(id, session.userId, "ASSIGNEE", "Changed assignees"));
      if (body.tagIds !== undefined) postUpdateWork.push(recordActivity(id, session.userId, "TAG", "Updated tags"));
      if (newAssigneeIds && newAssigneeIds.length > 0) {
        const { sendNotification } = await import("@/lib/send-notifications");
        newAssigneeIds
          .filter((uid: string) => uid !== session.userId)
          .forEach((uid: string) => {
            postUpdateWork.push(
              sendNotification(uid, {
                type: "ASSIGNED",
                title: `You were assigned to "${updated.title}"`,
                body: "",
                tag: `assigned-${id}`,
                taskId: id,
                boardId,
              })
            );
          });
      }
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
        assignees: {
          orderBy: { assignedAt: "asc" },
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
        },
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
      if (body.assigneeIds !== undefined) {
        postUpdateWork.push(recordActivity(id, session.userId, "ASSIGNEE", "Changed assignees"));
        if (newAssigneeIds && newAssigneeIds.length > 0) {
          const oldIds = new Set((current.assignees as { userId: string }[]).map((a) => a.userId));
          const { sendNotification } = await import("@/lib/send-notifications");
          newAssigneeIds
            .filter((uid: string) => uid !== session.userId && !oldIds.has(uid))
            .forEach((uid: string) => {
              postUpdateWork.push(
                sendNotification(uid, {
                  type: "ASSIGNED",
                  title: `You were assigned to "${updated.title}"`,
                  body: "",
                  tag: `assigned-${id}`,
                  taskId: id,
                  boardId,
                })
              );
            });
        }
      } else if (body.assigneeId !== undefined && body.assigneeId !== current.assigneeId) {
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



  // Class group boards: overlay educator-set roster names so the card doesn't
  // flash self-chosen names after an update. Then flatten the junction rows.
  const patchNameOverrides =
    updated.assigneeUser || updated.assignees?.length
      ? await getBoardNameOverrides(taskAuth.columnRel.boardId)
      : new Map<string, string>();
  if (updated.assigneeUser) {
    updated.assigneeUser.name = patchNameOverrides.get(updated.assigneeUser.id) ?? updated.assigneeUser.name;
  }
  const flatAssignees = (updated.assignees ?? []).map((a: any) => ({
    ...a.user,
    name: patchNameOverrides.get(a.user.id) ?? a.user.name,
  }));

  // Compose a minimal response; ensure `tags`, `comments`, and `activities` are present so
  // client code can safely replace local task objects without structural surprises.
  const response = {
    ...updated,
    assignees: flatAssignees,
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

  // Broadcast using the realtimeSecret already fetched in the initial auth query.
  try {
    const realtimeSecret = taskAuth.columnRel.board?.realtimeSecret;
    if (realtimeSecret) {
      await broadcastToBoard(realtimeSecret, { type: "task:update", task: response });
    }
  } catch (err) {
    console.error("Broadcast failed:", err);
  }

  return new NextResponse(bodyString, { headers: { "Content-Type": "application/json" } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    // Ensure the task exists and belongs to a board the user can access.
    const taskAuth = await prisma.task.findUnique({
      where: { id: id },
      select: {
        columnRel: {
          select: {
            boardId: true,
            board: {
              select: {
                realtimeSecret: true,
                members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!taskAuth || !taskAuth.columnRel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((taskAuth.columnRel.board?.members?.length ?? 0) === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.notification.deleteMany({ where: { taskId: id } });
    await prisma.task.delete({ where: { id: id } });

    // Broadcast the deletion using the realtimeSecret already fetched in the auth query.
    try {
      const realtimeSecret = taskAuth.columnRel.board?.realtimeSecret;
      if (realtimeSecret) {
        await broadcastToBoard(realtimeSecret, { type: "task:delete", taskId: id });
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
