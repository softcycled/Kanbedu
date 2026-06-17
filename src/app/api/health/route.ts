import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health
// Lightweight liveness + DB connectivity check.
// Returns 200 { ok: true, db: true } when healthy.
// Returns 503 if the DB is unreachable.
// Used by UptimeRobot and post-deploy CI health checks.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false, error: "DB unreachable" }, { status: 503 });
  }
}
