import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createCommentSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

export async function POST(req: Request) {
  const raw = await req.json();
  const result = parseBody(createCommentSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure the user is a member of the board that contains the task
  const taskRow = await prisma.task.findUnique({ where: { id: data.taskId }, select: { columnRel: { select: { boardId: true } } } });
  if (!taskRow || !taskRow.columnRel) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const allowed = await isMemberOfBoard(session.userId, taskRow.columnRel.boardId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      author: (user?.name && user.name.trim()) || user?.email || "Anonymous",
      taskId: data.taskId,
    },
  });

  await recordActivity(data.taskId, session.userId, "COMMENT", "Added a comment");

  return NextResponse.json(comment);
}
