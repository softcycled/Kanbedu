import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "hominghao1710@gmail.com";
const BOARD_IDS = [
  "demo-board-seed-0001",
  "demo-board-seed-0002",
  "demo-board-seed-0003",
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.error(`User not found: ${OWNER_EMAIL}`);
    process.exit(1);
  }
  console.log(`Found user: ${owner.name} (${owner.id})`);

  for (const boardId of BOARD_IDS) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      console.log(`Board not found: ${boardId} — skipping`);
      continue;
    }
    await prisma.boardMember.upsert({
      where: { userId_boardId: { userId: owner.id, boardId } },
      update: { role: "owner" },
      create: { userId: owner.id, boardId, role: "owner" },
    });
    console.log(`✓ Set owner on: "${board.name}"`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
