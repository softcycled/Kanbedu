import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const ipLimit = await checkRateLimit(ip, "reset_password_ip", 5, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid revealing whether an email is registered
  if (!user || !user.password) {
    return NextResponse.json({ success: true });
  }

  // Delete any existing tokens for this user, then create a fresh one
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const record = await prisma.passwordResetToken.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  await sendPasswordResetEmail(user.email, record.token).catch((err) =>
    console.error("Failed to send password reset email:", err)
  );

  return NextResponse.json({ success: true });
}
