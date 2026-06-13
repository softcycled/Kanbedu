import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const t0 = performance.now();
    const session = await getSession();
    const sessionMs = Math.round(performance.now() - t0);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const t1 = performance.now();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    const adminMs = Math.round(performance.now() - t1);

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const t2 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const pingMs = Math.round(performance.now() - t2);

    console.log(`[health] session=${sessionMs}ms isAdmin=${adminMs}ms ping=${pingMs}ms`);

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latency: `${pingMs}ms`,
      detail: { sessionMs, adminMs, pingMs },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({
      status: "unhealthy",
      database: "disconnected",
      error: "Could not connect to database",
    }, { status: 500 });
  }
}
