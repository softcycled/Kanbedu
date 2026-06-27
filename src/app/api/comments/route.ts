import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createCommentSchema, parseBody, parseJsonBody } from "@/lib/validations";
import { getVerifiedSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { broadcastToBoard } from "@/lib/broadcast";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req);
  if (parsed.error) return parsed.error;
  const raw = parsed.data;
  const result = parseBody(createCommentSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(session.userId, "comments_create", 30, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  // Fetch task auth (boardId + membership + realtimeSecret) and current user in parallel.
  const [taskRow, user] = await Promise.all([
    prisma.task.findUnique({
      where: { id: data.taskId },
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
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, handle: true, email: true } }),
  ]);
  if (!taskRow || !taskRow.columnRel) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if ((taskRow.columnRel.board?.members?.length ?? 0) === 0) {
    logAuthzDenied(req, "/api/comments", session.userId, "POST cross-tenant");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const author = user?.handle
    ? `@${user.handle}`
    : (user?.name && user.name.trim()) || user?.email || "Anonymous";

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      author,
      userId: session.userId,
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

  try {
    const realtimeSecret = taskRow.columnRel.board?.realtimeSecret;
    if (realtimeSecret) await broadcastToBoard(realtimeSecret);
  } catch (err) {
    console.error("Broadcast failed:", err);
  }

  return NextResponse.json(comment);
}
