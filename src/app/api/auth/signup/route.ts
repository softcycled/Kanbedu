import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { signupSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    // Strict rate limit: Max 5 signups per IP per hour to prevent bot mass-creation
    const ipLimit = await checkRateLimit(ip, "signup_ip", 5, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "Too many accounts created from this IP. Please try again later." }, { status: 429 });
    }

    const raw = await req.json();
    const result = parseBody(signupSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const [existingEmail, existingHandle] = await Promise.all([
      prisma.user.findUnique({ where: { email: data.email } }),
      prisma.user.findUnique({ where: { handle: data.handle } }),
    ]);
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (existingHandle) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const AVATAR_COLORS = ["#4A90A4","#A8CCE0","#2C4A6E","#4A7C59","#7CC8A0","#7A8C52","#3D8B6B","#D4A847","#C9B87A","#BE6A43","#C45C6A","#D47060","#A83252","#D4A0A8","#9B8CC4","#7A5FAF"];
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name, handle: data.handle, color: randomColor },
    });

    // Create a 24-hour verification token and send the email
    try {
      const record = await prisma.emailVerification.create({
        data: { userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      await sendVerificationEmail(user.email, record.token);
    } catch (err) {
      console.error("Failed to send verification email:", err);
    }

    await createSession(user.id);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, handle: user.handle });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
