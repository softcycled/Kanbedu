import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Public, unauthenticated capture for the Lecturer Pro early-access waitlist.
// Rate limited per IP to deter bot floods. Idempotent on email so repeat
// submissions succeed without leaking whether the address is already listed.
const waitlistSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").toLowerCase().max(254),
  source: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimit(ip, "pro_waitlist", 5, 60);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = waitlistSchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const { email, source } = result.data;

    await prisma.proWaitlist.upsert({
      where: { email },
      update: {},
      create: { email, source: source || "pricing" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to add to Pro waitlist:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
