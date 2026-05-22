import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.user
  .findUnique({ where: { email: "hominghao1710@gmail.com" } })
  .then((u) => console.log(u ?? "NOT FOUND"))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
