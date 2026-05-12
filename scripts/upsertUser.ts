import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const id = process.env.UP_USER_ID ?? "demo-user-alice";
  const name = process.env.UP_USER_NAME ?? "Alice";
  const email = process.env.UP_USER_EMAIL ?? `${id}@demo.kanbedu`;
  const color = process.env.UP_USER_COLOR ?? "#4A90A4";

  console.log(`Upserting user id=${id} email=${email}`);

  await prisma.user.upsert({
    where: { id },
    update: { name, email, color },
    create: { id, name, email, color },
  });

  console.log(`✅ Upserted user ${id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
