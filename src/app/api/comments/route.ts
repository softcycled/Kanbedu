import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { taskId, content } = await req.json();

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      taskId,
    },
  });

  return NextResponse.json(comment);
}
