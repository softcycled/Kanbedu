import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// Returns the real client IP from trusted Vercel headers.
// x-real-ip is set by Vercel's edge and is not client-spoofable.
// Falls back to the rightmost entry in x-forwarded-for (added by the closest proxy),
// which is harder to spoof than the leftmost (client-controlled) entry.
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const last = xff.split(",").at(-1)?.trim();
    if (last) return last;
  }

  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetDate: Date;
}

/**
 * Checks and increments a rate limit for a specific identifier and route.
 * Uses the database as a ledger, maintaining a $0.00 budget.
 */
export async function checkRateLimit(
  identifier: string,
  route: string,
  limit: number,
  windowMinutes: number,
  increment: boolean = true
): Promise<RateLimitResult> {
  const now = new Date();

  // 10% chance to perform cleanup of expired records to prevent database bloat over time
  if (Math.random() < 0.1) {
    // Fire and forget, don't await so it doesn't block the request
    prisma.rateLimit
      .deleteMany({
        where: { expiresAt: { lt: now } },
      })
      .catch(() => {});
  }

  // Read-only peek: report the current bucket without consuming a hit.
  if (!increment) {
    const record = await prisma.rateLimit.findUnique({
      where: { identifier_route: { identifier, route } },
    });
    if (!record || record.expiresAt < now) {
      return { allowed: true, remaining: limit, resetDate: new Date(now.getTime() + windowMinutes * 60000) };
    }
    return { allowed: record.hits < limit, remaining: Math.max(0, limit - record.hits), resetDate: record.expiresAt };
  }

  const newExpiry = new Date(now.getTime() + windowMinutes * 60000);

  // Atomic check-and-increment in a single statement. The INSERT creates the
  // bucket; on conflict it increments hits, resetting the window if it has
  // already expired. Postgres takes a row lock on the conflicting row, so
  // concurrent callers are serialized and each gets a distinct post-increment
  // hit count. This closes the read-then-write race the previous two-step
  // (findUnique then update) implementation had, where parallel requests could
  // all read the same count and overshoot the limit.
  const rows = await prisma.$queryRaw<{ hits: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("id", "identifier", "route", "hits", "expiresAt")
    VALUES (${randomUUID()}, ${identifier}, ${route}, 1, ${newExpiry})
    ON CONFLICT ("identifier", "route") DO UPDATE SET
      "hits" = CASE WHEN "RateLimit"."expiresAt" < ${now} THEN 1 ELSE "RateLimit"."hits" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < ${now} THEN ${newExpiry} ELSE "RateLimit"."expiresAt" END
    RETURNING "hits", "expiresAt";
  `;

  const row = rows[0];
  const hits = Number(row.hits);
  // Allowed when this request's own hit count is within the limit. The first
  // `limit` requests in a window get hits 1..limit (allowed); the rest exceed
  // it (denied) without extending the window.
  return { allowed: hits <= limit, remaining: Math.max(0, limit - hits), resetDate: row.expiresAt };
}
