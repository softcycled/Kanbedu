import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email already verified." }, { status: 400 });

  // Rate limit: max 3 resend requests per hour per user
  const limit = await checkRateLimit(user.id, "resend_verification", 3, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before requesting another verification email." }, { status: 429 });
  }

  // Delete any existing tokens and create a fresh one
  await prisma.emailVerification.deleteMany({ where: { userId: user.id } });
  const record = await prisma.emailVerification.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, record.token);

  return NextResponse.json({ success: true });
}
