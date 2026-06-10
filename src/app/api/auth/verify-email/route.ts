import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const limit = await checkRateLimit(ip, "email_verify", 5, 15);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const record = await prisma.emailVerification.findUnique({ where: { token } });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 404 });
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerification.delete({ where: { id: record.id } });
    return NextResponse.json({ error: "This verification link has expired. Please request a new one." }, { status: 410 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.emailVerification.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ success: true });
}
