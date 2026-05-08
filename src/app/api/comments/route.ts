import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createCommentSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";

export async function POST(req: Request) {
  const raw = await req.json();
  const { data, error } = parseBody(createCommentSchema, raw);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
