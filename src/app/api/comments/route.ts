import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createCommentSchema, parseBody } from "@/lib/validations";

export async function POST(req: Request) {
  const raw = await req.json();
  const result = parseBody(createCommentSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const data = result.data;

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      author: data.author,
      taskId: data.taskId,
    },
  });

  return NextResponse.json(comment);
}
