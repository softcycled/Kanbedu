import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_BOARD_IDS = [
  "demo-board-seed-0001",
  "demo-board-seed-0002",
  "demo-board-seed-0003",
];
const DEMO_USER_EMAILS = [
  "alice@demo.kanbedu", "bob@demo.kanbedu", "carol@demo.kanbedu",
  "dave@demo.kanbedu", "jake@demo.kanbedu", "emma@demo.kanbedu",
  "priya@demo.kanbedu", "sam@demo.kanbedu", "mia@demo.kanbedu",
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
    // BoardMember cascades with board deletion
    await prisma.board.deleteMany({ where: { id: boardId } });
    console.log(`Wiped demo board: ${boardId}`);
  }
  await prisma.user.deleteMany({ where: { email: { in: DEMO_USER_EMAILS } } });
  console.log("All demo boards and users wiped.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
