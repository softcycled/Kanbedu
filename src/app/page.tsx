import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BoardContainer from "@/components/BoardContainer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/landing");

  // Run user lookup + board memberships in parallel
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    }),
    prisma.boardMember.findMany({
      where: { userId: session.userId },
      include: { board: true },
      orderBy: { board: { order: "asc" } },
    }),
  ]);

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

  // Run columns + tasks in parallel — tasks filter by relation instead of prefetching column IDs
  const [boardColumns, tasks] = await Promise.all([
    prisma.column.findMany({
      where: { boardId: firstBoard.id },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { columnRel: { boardId: firstBoard.id } },
      include: {
        comments: {
          select: { id: true, content: true, author: true, createdAt: true, taskId: true },
          orderBy: { createdAt: "asc" },
        },
        assigneeUser: { select: { id: true, name: true, color: true } },
        tags: true,
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
    }),
  ]);

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
      isAdmin={!!user?.isAdmin}
    />
  );
}
