import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { signupSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

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
      return NextResponse.json({ error: "That handle is already taken." }, { status: 409 });
    }

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name, handle: data.handle },
    });

    await createSession(user.id);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, handle: user.handle });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
