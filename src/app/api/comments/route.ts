import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createCommentSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const raw = await req.json();
  const result = parseBody(createCommentSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(session.userId, "comments_create", 30, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  // Ensure the user is a member of the board that contains the task
  const taskRow = await prisma.task.findUnique({ where: { id: data.taskId }, select: { columnRel: { select: { boardId: true } } } });
  if (!taskRow || !taskRow.columnRel) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const allowed = await isMemberOfBoard(session.userId, taskRow.columnRel.boardId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, handle: true, email: true } });

  const author = user?.handle
    ? `@${user.handle}`
    : (user?.name && user.name.trim()) || user?.email || "Anonymous";

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      author,
      taskId: data.taskId,
    },
  });

  await recordActivity(data.taskId, session.userId, "COMMENT", "Added a comment");

  // Fire-and-forget: notify task assignees about the new comment
  (async () => {
    try {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: { title: true, assignees: { select: { userId: true } }, columnRel: { select: { boardId: true } } },
      });
      if (!task) return;
      const { sendNotification } = await import("@/lib/send-notifications");
      await Promise.allSettled(
        task.assignees
          .filter((a) => a.userId !== session.userId)
          .map((a) =>
            sendNotification(a.userId, {
              type: "COMMENT",
              title: `New comment on "${task.title}"`,
              body: data.content.slice(0, 120),
              tag: `comment-${data.taskId}`,
              taskId: data.taskId,
              boardId: task.columnRel?.boardId ?? undefined,
            })
          )
      );
    } catch (err) {
      console.error("[notifications] comment trigger failed:", err);
    }
  })();

  prisma.board.findUnique({
    where: { id: taskRow.columnRel.boardId },
    select: { realtimeSecret: true },
  }).then((board) => {
    if (board?.realtimeSecret) broadcastToBoard(board.realtimeSecret);
  }).catch((err) => console.error("Failed to fetch realtimeSecret:", err));

  return NextResponse.json(comment);
}
