import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BoardContainer from "@/components/BoardContainer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/landing");

  // Load boards the user is a member of
  const memberships = await prisma.boardMember.findMany({
    where: { userId: session.userId },
    include: { board: true },
    orderBy: { board: { order: "asc" } },
  });

  let boards = memberships.map((m) => m.board);

  // First-time user: create a default board
  if (boards.length === 0) {
    const board = await prisma.board.create({
      data: { name: "My Board" },
    });
    await prisma.boardMember.create({
      data: { userId: session.userId, boardId: board.id, role: "owner" },
    });
    await prisma.column.createMany({
      data: [
        { label: "To Do", order: 0, isDone: false, boardId: board.id },
        { label: "In Progress", order: 1, isDone: false, boardId: board.id },
        { label: "Done", order: 2, isDone: true, boardId: board.id },
      ],
    });
    boards = [board];
  }

  const firstBoard = boards[0];

  // Load columns + tasks for the first board in one query
  const boardColumns = await prisma.column.findMany({
    where: { boardId: firstBoard.id },
    orderBy: { order: "asc" },
  });

  const columnIds = boardColumns.map((c) => c.id);

  const tasks =
    columnIds.length > 0
      ? await prisma.task.findMany({
          where: { column: { in: columnIds } },
          include: {
            comments: {
              select: { id: true, content: true, author: true, createdAt: true, taskId: true },
              orderBy: { createdAt: "asc" },
            },
            assigneeUser: { select: { id: true, name: true, color: true } },
            tags: true,
            activities: {
              include: { user: { select: { id: true, name: true, color: true } } },
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
          orderBy: [{ column: "asc" }, { order: "asc" }],
        })
      : [];

  const serializedTasks = tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    columnUpdatedAt: t.columnUpdatedAt.toISOString(),
    deadline: t.deadline?.toISOString() ?? null,
    comments: t.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    activities: t.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  const serializedBoards = boards.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <BoardContainer
      initialTasks={serializedTasks}
      initialBoards={serializedBoards}
      initialBoardId={firstBoard.id}
      initialColumns={boardColumns}
      currentUserId={session.userId}
    />
  );
}
