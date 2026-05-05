import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BOARD_ID = "demo-board-seed-0001";

async function main() {
  const cols = await prisma.column.findMany({ where: { boardId: BOARD_ID }, select: { id: true } });
  const colIds = cols.map((c) => c.id);
  const tasks = await prisma.task.findMany({ where: { column: { in: colIds } }, select: { id: true } });
  const taskIds = tasks.map((t) => t.id);
  await prisma.taskColumnHistory.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.column.deleteMany({ where: { boardId: BOARD_ID } });
  await prisma.board.deleteMany({ where: { id: BOARD_ID } });
  console.log("Demo board wiped.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
