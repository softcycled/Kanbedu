import { PrismaClient } from "@prisma/client";
import { neon } from "@neondatabase/serverless";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    const sql = neon(process.env.DATABASE_URL!);
    const adapter = new PrismaNeonHTTP(sql);
    return new PrismaClient({ adapter, log: ["error"] });
  }
  return new PrismaClient({ log: ["error"] });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
