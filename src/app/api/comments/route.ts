import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { taskId, content, author } = await req.json();

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      author: (author ?? "").trim(),
      taskId,
    },
  });

  return NextResponse.json(comment);
}
