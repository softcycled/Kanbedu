import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";
import { getClientIp } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin status
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      logSecurityEvent({ type: "admin_denied", route: "/api/admin/reports", ip: getClientIp(req), userId: session.userId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reports = await prisma.bugReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    logSecurityEvent({ type: "admin_action", route: "/api/admin/reports", userId: session.userId, detail: "list bug reports" });
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Admin reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
