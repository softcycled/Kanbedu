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

  const record = await prisma.rateLimit.findUnique({
    where: { identifier_route: { identifier, route } },
  });

  if (!record || record.expiresAt < now) {
    // Record doesn't exist or is expired, reset the bucket
    const expiresAt = new Date(now.getTime() + windowMinutes * 60000);
    const newRecord = await prisma.rateLimit.upsert({
      where: { identifier_route: { identifier, route } },
      update: { hits: 1, expiresAt },
      create: { identifier, route, hits: 1, expiresAt },
    });
    return { allowed: true, remaining: limit - 1, resetDate: newRecord.expiresAt };
  }

  // Record exists and is active. Check if limit is exceeded.
  if (record.hits >= limit) {
    return { allowed: false, remaining: 0, resetDate: record.expiresAt };
  }

  if (!increment) {
    return { allowed: true, remaining: limit - record.hits, resetDate: record.expiresAt };
  }

  // Increment hits
  const updated = await prisma.rateLimit.update({
    where: { id: record.id },
    data: { hits: { increment: 1 } },
  });

  return { allowed: true, remaining: limit - updated.hits, resetDate: updated.expiresAt };
}
