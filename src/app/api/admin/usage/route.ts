import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
      logSecurityEvent({ type: "admin_denied", route: "/api/admin/usage", userId: session.userId });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = Date.now();
    const since1d = new Date(now - 1 * 24 * 60 * 60 * 1000);
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [deviceGroups, eventGroups, active1d, active7d, active30d, panelRows] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["device"],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["event"],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { event: "desc" } },
        take: 10,
      }),
      prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since1d } }, distinct: ["userId"], select: { userId: true } }),
      prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since7d } }, distinct: ["userId"], select: { userId: true } }),
      prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since30d } }, distinct: ["userId"], select: { userId: true } }),
      // Metadata is JSON, so the panel breakdown needs a raw query to group by
      // the "panel" key inside it.
      prisma.$queryRaw<{ panel: string; count: bigint }[]>`
        SELECT metadata->>'panel' as panel, COUNT(*) as count
        FROM "AnalyticsEvent"
        WHERE event = 'panel_view' AND "createdAt" >= ${since30d} AND metadata->>'panel' IS NOT NULL
        GROUP BY metadata->>'panel'
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const deviceSplit = { desktop: 0, mobile: 0, unknown: 0 };
    for (const g of deviceGroups) {
      const key = g.device === "desktop" ? "desktop" : g.device === "mobile" ? "mobile" : "unknown";
      deviceSplit[key] += g._count._all;
    }

    return NextResponse.json({
      windowDays: 30,
      deviceSplit,
      topEvents: eventGroups.map((g) => ({ event: g.event, count: g._count._all })),
      topPanels: panelRows.map((r) => ({ panel: r.panel, count: Number(r.count) })),
      activeUsers: {
        last24h: active1d.length,
        last7d: active7d.length,
        last30d: active30d.length,
      },
    });
  } catch (error) {
    console.error("Usage stats error:", error);
    return NextResponse.json({ error: "Could not load usage stats" }, { status: 500 });
  }
}
