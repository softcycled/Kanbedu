import { prisma } from "@/lib/prisma";
import BoardContainer from "@/components/BoardContainer";

export const dynamic = "force-dynamic";

const DEFAULT_BOARD_ID = "cldefaultboard0000";

export default async function Home() {
  // Load boards
  let boards = await prisma.board.findMany({ orderBy: { createdAt: "asc" } });

  if (boards.length === 0) {
    const board = await prisma.board.create({
      data: { id: DEFAULT_BOARD_ID, name: "My Board" },
    });
    boards = [board];
  }

  const firstBoard = boards[0];

  // Load tasks for the first board
  const boardColumns = await prisma.column.findMany({
    where: { boardId: firstBoard.id },
    select: { id: true },
  });

  const columnIds = boardColumns.map((c) => c.id);

  const tasks =
    columnIds.length > 0
      ? await prisma.task.findMany({
          where: { column: { in: columnIds } },
          include: { comments: { orderBy: { createdAt: "asc" } } },
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
    />
  );
}

