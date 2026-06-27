import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getVerifiedSession, getClassRole } from "@/lib/auth";
import { broadcastToBoard } from "@/lib/broadcast";
import { getBoardNameOverrides } from "@/lib/classNames";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";

// POST /api/tasks/[id]/restore — bring a soft-deleted task back to its board.
// Authorization: any board member may restore on a personal board. On a class
// group board, only an educator/TA may restore, OR the user who deleted it
// (covers the immediate Undo toast after a student deletes their own task).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const task = await prisma.task.findUnique({
      where: { id: id },
      select: {
        deletedAt: true,
        deletedBy: true,
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

    if (!task || !task.columnRel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((task.columnRel.board?.members?.length ?? 0) === 0) {
      logAuthzDenied(req, "/api/tasks/[id]/restore", session.userId, "restore cross-tenant");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!task.deletedAt) {
      return NextResponse.json({ error: "Task is not deleted." }, { status: 400 });
    }

    const boardId = task.columnRel.boardId;

    // Class group boards restrict restore to educators/TAs, with a carve-out for
    // the original deleter so their own Undo always works.
    const group = await prisma.group.findUnique({ where: { boardId }, select: { classId: true } });
    if (group) {
      const role = await getClassRole(session.userId, group.classId);
      const isManager = role === "educator" || role === "ta";
      const isDeleter = task.deletedBy === session.userId;
      if (!isManager && !isDeleter) {
        logAuthzDenied(req, "/api/tasks/[id]/restore", session.userId, "restore not educator/deleter");
        return NextResponse.json({ error: "Only educators can restore this task." }, { status: 403 });
      }
    }

    const restored = await prisma.task.update({
      where: { id: id },
      data: { deletedAt: null, deletedBy: null },
      include: {
        _count: { select: { comments: true } },
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        assignees: {
          orderBy: { assignedAt: "asc" },
          include: { user: { select: { id: true, name: true, color: true, handle: true } } },
        },
        tags: true,
      },
    });

    // Reshape to the lean board payload (class group boards show roster names).
    const nameOverrides = await getBoardNameOverrides(boardId);
    const responseTask = {
      ...restored,
      assigneeUser: restored.assigneeUser
        ? { ...restored.assigneeUser, name: nameOverrides.get(restored.assigneeUser.id) ?? restored.assigneeUser.name }
        : restored.assigneeUser,
      assignees: restored.assignees.map((a) => ({
        ...a.user,
        name: nameOverrides.get(a.user.id) ?? a.user.name,
      })),
      comments: [],
      commentCount: (restored as any)._count?.comments ?? 0,
    };

    try {
      const realtimeSecret = task.columnRel.board?.realtimeSecret;
      if (realtimeSecret) {
        await broadcastToBoard(realtimeSecret, { type: "task:create", task: responseTask });
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

    return NextResponse.json(responseTask);
  } catch (error) {
    console.error("Failed to restore task:", error);
    return NextResponse.json({ error: "Failed to restore task" }, { status: 500 });
  }
}
