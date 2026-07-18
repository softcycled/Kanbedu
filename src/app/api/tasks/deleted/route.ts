import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole } from "@/lib/auth";
import { getBoardNameOverrides } from "@/lib/classNames";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// GET /api/tasks/deleted?boardId= — list soft-deleted tasks for a board (trash).
// On a class group board this is educators/TAs only. Runs the 30-day purge for
// the board lazily on read, so no cron is required.
export async function GET(request: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const boardId = new URL(request.url).searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId is required" }, { status: 400 });

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.userId, boardId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Class group boards: trash is educator/TA only. Personal boards: any member.
  const group = await prisma.group.findUnique({ where: { boardId }, select: { classId: true } });
  if (group) {
    const role = await getClassRole(session.userId, group.classId);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can view deleted tasks." }, { status: 403 });
    }
  }

  // Lazy purge: permanently remove this board's tasks deleted over 30 days ago.
  // Notifications have no task FK, so clear them explicitly (as hard delete did);
  // comments/assignees/activities cascade with the task row.
  try {
    const cutoff = new Date(Date.now() - PURGE_AFTER_MS);
    const stale = await prisma.task.findMany({
      where: { columnRel: { boardId }, deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length > 0) {
      const staleIds = stale.map((t) => t.id);
      await prisma.notification.deleteMany({ where: { taskId: { in: staleIds } } });
      await prisma.task.deleteMany({ where: { id: { in: staleIds } } });
    }
  } catch (err) {
    console.error("Trash purge failed:", err);
  }

  const tasks = await prisma.task.findMany({
    where: { columnRel: { boardId }, deletedAt: { not: null } },
    include: {
      _count: { select: { comments: true } },
      assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
      assignees: {
        orderBy: { assignedAt: "asc" },
        include: { user: { select: { id: true, name: true, color: true, handle: true } } },
      },
      tags: true,
    },
    orderBy: { deletedAt: "desc" },
  });

  const nameOverrides = await getBoardNameOverrides(boardId);

  // Resolve deleter display names (roster name wins on class boards).
  const deleterIds = [...new Set(tasks.map((t) => t.deletedBy).filter((v): v is string => !!v))];
  const deleters = deleterIds.length
    ? await prisma.user.findMany({ where: { id: { in: deleterIds } }, select: { id: true, name: true } })
    : [];
  const deleterNames = new Map(deleters.map((u) => [u.id, nameOverrides.get(u.id) ?? u.name]));

  const mapped = tasks.map((t) => ({
    ...t,
    assigneeUser: t.assigneeUser
      ? { ...t.assigneeUser, name: nameOverrides.get(t.assigneeUser.id) ?? t.assigneeUser.name }
      : t.assigneeUser,
    assignees: t.assignees.map((a) => ({ ...a.user, name: nameOverrides.get(a.user.id) ?? a.user.name })),
    comments: [],
    commentCount: (t as any)._count?.comments ?? 0,
    deletedByName: t.deletedBy ? deleterNames.get(t.deletedBy) ?? null : null,
  }));

  return NextResponse.json({ tasks: mapped });
}

// DELETE /api/tasks/deleted?boardId= — permanently empty the trash for a board,
// skipping the 30-day restore window. Same authorization as viewing trash:
// educators/TAs only on a class group board, any member on a personal board.
export async function DELETE(request: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const boardId = new URL(request.url).searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId is required" }, { status: 400 });

  const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.userId, boardId } },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const group = await prisma.group.findUnique({ where: { boardId }, select: { classId: true } });
  if (group) {
    const role = await getClassRole(session.userId, group.classId);
    if (role !== "educator" && role !== "ta") {
      logAuthzDenied(request, "/api/tasks/deleted", session.userId, "DELETE empty-trash not educator");
      return NextResponse.json({ error: "Only educators can empty the trash." }, { status: 403 });
    }
  }

  const trashed = await prisma.task.findMany({
    where: { columnRel: { boardId }, deletedAt: { not: null } },
    select: { id: true },
  });
  if (trashed.length === 0) return NextResponse.json({ deletedCount: 0 });

  const ids = trashed.map((t) => t.id);
  await prisma.notification.deleteMany({ where: { taskId: { in: ids } } });
  await prisma.task.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ deletedCount: ids.length });
}
