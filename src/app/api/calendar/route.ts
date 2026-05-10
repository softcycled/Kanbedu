import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

// Returns all tasks with deadlines across all boards the user is a member of.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memberships = await prisma.boardMember.findMany({
      where: { userId: session.userId },
      select: { boardId: true, board: { select: { id: true, name: true } } },
    });

    const boardIds = memberships.map((m) => m.boardId);
    if (boardIds.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    const columns = await prisma.column.findMany({
      where: { boardId: { in: boardIds } },
      select: { id: true, boardId: true, isDone: true },
    });

    const columnIds = columns.map((c) => c.id);
    const columnMap = new Map(columns.map((c) => [c.id, c]));
    const boardMap = new Map(memberships.map((m) => [m.boardId, m.board.name]));

    const tasks = await prisma.task.findMany({
      where: {
        column: { in: columnIds },
        deadline: { not: null },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        priority: true,
        completedAt: true,
        column: true,
        assigneeUser: { select: { id: true, name: true, color: true } },
      },
      orderBy: { deadline: "asc" },
    });

    const result = tasks.map((t) => {
      const col = columnMap.get(t.column);
      return {
        id: t.id,
        title: t.title,
        deadline: t.deadline!.toISOString(),
        priority: t.priority,
        isDone: col?.isDone ?? false,
        boardId: col?.boardId ?? "",
        boardName: boardMap.get(col?.boardId ?? "") ?? "Unknown",
        assignee: t.assigneeUser
          ? { name: t.assigneeUser.name, color: t.assigneeUser.color }
          : null,
      };
    });

    return NextResponse.json({ tasks: result });
  } catch (error: any) {
    console.error("Calendar API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
