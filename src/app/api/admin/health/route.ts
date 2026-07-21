import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      logSecurityEvent({ type: "admin_denied", route: "/api/admin/health", userId: session.userId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - start);

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latency: `${latency}ms`,
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
