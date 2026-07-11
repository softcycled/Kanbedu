import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Admins (and anyone testing/QA-ing the app) shouldn't skew usage numbers
  // meant to reflect real lecturer/student behavior. Silently no-op instead
  // of erroring, so the client's fire-and-forget call never has to know.
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isAdmin: true } });
  if (user?.isAdmin) return NextResponse.json({ ok: true });

  // Generous per-user cap: enough for normal use, tight enough to stop a
  // runaway client-side loop from writing unbounded rows.
  const limit = await checkRateLimit(session.userId, "analytics_track", 120, 1);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limited." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { event, device, metadata } = (body ?? {}) as {
    event?: unknown;
    device?: unknown;
    metadata?: unknown;
  };

  if (typeof event !== "string" || !(ANALYTICS_EVENTS as readonly string[]).includes(event)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }
  const safeDevice = device === "desktop" || device === "mobile" ? device : null;
  const safeMetadata =
    metadata && typeof metadata === "object" && JSON.stringify(metadata).length < 500
      ? (metadata as object)
      : undefined;

  try {
    await prisma.analyticsEvent.create({
      data: { userId: session.userId, event, device: safeDevice, metadata: safeMetadata },
    });
  } catch (error) {
    // Never let analytics failures surface to the user or block the app.
    console.error("Analytics write failed:", error);
  }

  return NextResponse.json({ ok: true });
}
