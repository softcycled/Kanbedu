import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession, isMemberOfBoard } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify membership for the task's board
  const taskRow = await prisma.task.findUnique({ where: { id: params.id }, select: { columnRel: { select: { boardId: true } } } });
  if (!taskRow || !taskRow.columnRel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed = await isMemberOfBoard(session.userId, taskRow.columnRel.boardId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const versions = await prisma.taskDescriptionVersion.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(versions);
}
