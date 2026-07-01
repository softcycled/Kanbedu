import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { handleSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(ip, "handle_check", 200, 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("handle");

  if (!raw) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const parsed = handleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ available: false, error: parsed.error.issues[0].message });
  }

  const handle = parsed.data;
  const existing = await prisma.user.findUnique({ where: { handle } });
  return NextResponse.json({ available: !existing });
}
