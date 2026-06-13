import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { resetPasswordRequestSchema, parseBody } from "@/lib/validations";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(ip, "reset_password_ip", 5, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = parseBody(resetPasswordRequestSchema, raw);
  if (!result.data) {
    // Return success anyway — don't reveal whether the email is valid
    return NextResponse.json({ success: true });
  }
  const { email } = result.data;

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
