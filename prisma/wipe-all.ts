/**
 * Wipes ALL data from the LOCAL database, in FK-safe order.
 * Refuses to run unless DATABASE_URL points at localhost — so it can never
 * touch the cloud/production database by accident.
 *
 * Run with the local connection, e.g.:
 *   (set DATABASE_URL/DIRECT_URL from .env.local) ; npx tsx prisma/wipe-all.ts
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  /* leave host empty */
}
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error(
    `Refusing to wipe: DATABASE_URL host is "${host || "unknown"}", not localhost.\n` +
      `This script only runs against a local database. Set the local connection first.`
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Children first, then parents, to satisfy foreign keys.
  await prisma.taskActivity.deleteMany();
  await prisma.taskDescriptionVersion.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskColumnHistory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.column.deleteMany();

  await prisma.classPreset.deleteMany();
  await prisma.classMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.class.deleteMany();

  await prisma.boardInvite.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.board.deleteMany();

  await prisma.emailVerification.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.bugReport.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.user.deleteMany();

  console.log(`Wiped ALL data from local DB (${host}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
