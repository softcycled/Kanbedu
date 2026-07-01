import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword, createSession } from "@/lib/auth";
import { signupSchema, parseBody } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    // Rate limit signups per IP to block bots — raised for shared campus/classroom networks
    const ipLimit = await checkRateLimit(ip, "signup_ip", 100, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "Too many accounts created from this IP. Please try again later." }, { status: 429 });
    }

    const raw = await req.json();
    const nextRaw: unknown = typeof raw === "object" && raw !== null ? (raw as any).next : undefined;
    const next =
      typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
        ? nextRaw
        : undefined;
    const result = parseBody(signupSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const [existingEmail, existingHandle, rosterEntry] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.user.findUnique({ where: { handle: data.handle } }),
      prisma.classRosterEntry.findFirst({ where: { email: data.email }, select: { id: true } }),
    ]);
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (existingHandle) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    // If this email was imported by an educator, it's already proven real — skip verification.
    const preVerified = !!rosterEntry;

    const AVATAR_COLORS = ["#4A90A4","#A8CCE0","#2C4A6E","#4A7C59","#7CC8A0","#7A8C52","#3D8B6B","#D4A847","#C9B87A","#BE6A43","#C45C6A","#D47060","#A83252","#D4A0A8","#9B8CC4","#7A5FAF"];
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name, handle: data.handle, color: randomColor, emailVerified: preVerified },
    });

    if (!preVerified) {
      // Create a 24-hour verification token and send the email
      try {
        const record = await prisma.emailVerification.create({
          data: { userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        await sendVerificationEmail(user.email, record.token, next);
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    }

    await createSession(user.id);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, handle: user.handle, emailVerified: preVerified });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email or username already exists." }, { status: 409 });
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
