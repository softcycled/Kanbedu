import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const enablePrismaQueryLogging = process.env.NODE_ENV !== "production";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: enablePrismaQueryLogging ? ["query", "info", "warn", "error"] : ["error"],
  });

// Attach verbose listeners in non-production for instrumentation
if (enablePrismaQueryLogging) {
  // Use `any` cast to avoid strict typing differences across Prisma versions for instrumentation hooks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (e: any) => {
    try {
      console.info("[prisma] query", { query: e.query, params: e.params, duration: e.duration, timestamp: new Date().toISOString() });
    } catch (err) {
      console.info("[prisma] query", e);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("info", (e: any) => console.info("[prisma] info", e));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("warn", (e: any) => console.warn("[prisma] warn", e));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("error", (e: any) => console.error("[prisma] error", e));
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
