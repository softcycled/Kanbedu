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
const DEMO_CLASS_ID = "demo-class-cs301";

async function wipeDemoBoard(boardId: string) {
  const cols = await prisma.column.findMany({ where: { boardId }, select: { id: true } });
  const colIds = cols.map((c) => c.id);
  const tasks = await prisma.task.findMany({ where: { column: { in: colIds } }, select: { id: true } });
  const taskIds = tasks.map((t) => t.id);
  await prisma.taskColumnHistory.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskActivity.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.column.deleteMany({ where: { boardId } });
  await prisma.boardMember.deleteMany({ where: { boardId } });
  await prisma.board.deleteMany({ where: { id: boardId } });
}

async function main() {
  // Wipe demo class and its group boards
  const groups = await prisma.group.findMany({
    where: { classId: DEMO_CLASS_ID },
    select: { boardId: true },
  });
  for (const { boardId } of groups) {
    if (boardId) {
      await wipeDemoBoard(boardId);
      console.log(`Wiped group board: ${boardId}`);
    }
  }
  await prisma.classPreset.deleteMany({ where: { classId: DEMO_CLASS_ID } });
  await prisma.classMember.deleteMany({ where: { classId: DEMO_CLASS_ID } });
  await prisma.classRosterEntry.deleteMany({ where: { classId: DEMO_CLASS_ID } });
  await prisma.group.deleteMany({ where: { classId: DEMO_CLASS_ID } });
  await prisma.class.deleteMany({ where: { id: DEMO_CLASS_ID } });
  console.log("Wiped demo class.");

  // Wipe demo boards
  for (const boardId of DEMO_BOARD_IDS) {
    await wipeDemoBoard(boardId);
    console.log(`Wiped demo board: ${boardId}`);
  }

  // Wipe demo users
  const DEMO_USER_IDS = [
    "demo-user-alice", "demo-user-bob", "demo-user-carol",
    "demo-user-dave", "demo-user-jake", "demo-user-emma",
    "demo-user-priya", "demo-user-sam", "demo-user-mia",
  ];
  await prisma.taskDescriptionVersion.deleteMany({ where: { userId: { in: DEMO_USER_IDS } } });
  await prisma.bugReport.deleteMany({ where: { userId: { in: DEMO_USER_IDS } } });
  await prisma.user.deleteMany({ where: { OR: [{ email: { in: DEMO_USER_EMAILS } }, { id: { in: DEMO_USER_IDS } }] } });
  console.log("All demo boards, class, and users wiped.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
