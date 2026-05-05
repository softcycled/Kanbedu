import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_BOARD_IDS = [
  "demo-board-seed-0001",
  "demo-board-seed-0002",
  "demo-board-seed-0003",
];

async function main() {
  for (const boardId of DEMO_BOARD_IDS) {
    const cols = await prisma.column.findMany({ where: { boardId }, select: { id: true } });
    const colIds = cols.map((c) => c.id);
    const tasks = await prisma.task.findMany({ where: { column: { in: colIds } }, select: { id: true } });
    const taskIds = tasks.map((t) => t.id);
    await prisma.taskColumnHistory.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    await prisma.column.deleteMany({ where: { boardId } });
    await prisma.board.deleteMany({ where: { id: boardId } });
    console.log(`Wiped demo board: ${boardId}`);
  }
  console.log("All demo boards wiped.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
