import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLog";
import { getBrevoTodayStats } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      logSecurityEvent({ type: "admin_denied", route: "/api/admin/email-stats", userId: session.userId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await getBrevoTodayStats();
    if (!stats) return NextResponse.json({ available: false });

    return NextResponse.json({
      available: true,
      sent: stats.sent,
      limit: stats.limit,
      remaining: stats.limit - stats.sent,
      warning: stats.sent >= stats.limit * 0.8,
    });
  } catch (error) {
    console.error("Email stats error:", error);
    return NextResponse.json({ available: false });
  }
}
