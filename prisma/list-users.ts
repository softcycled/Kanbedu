import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.user
  .findMany({ select: { id: true, email: true, name: true }, orderBy: { createdAt: "desc" }, take: 30 })
  .then((u) => console.log(JSON.stringify(u, null, 2)))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
