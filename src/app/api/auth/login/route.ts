import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    // 1. IP-based rate limiting (20 attempts per 15 min per IP) to prevent generic botnet spam
    const ipLimit = await checkRateLimit(ip, "login_ip", 20, 15);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "Too many requests from this IP. Try again in 15 minutes." }, { status: 429 });
    }

    const raw = await req.json();
    const result = parseBody(loginSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // 2. Account Lockout Check (Check without incrementing yet)
    // 5 failed attempts per 15 minutes locks the account
    const emailLimit = await checkRateLimit(data.email, "login_email_lockout", 5, 15, false);
    if (!emailLimit.allowed) {
      return NextResponse.json({ error: "Account locked due to too many failed attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !user.password) {
      // Increment the failed attempt counter for this email
      await checkRateLimit(data.email, "login_email_lockout", 5, 15, true);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await verifyPassword(data.password, user.password);
    if (!valid) {
      // Increment the failed attempt counter for this email
      await checkRateLimit(data.email, "login_email_lockout", 5, 15, true);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await createSession(user.id);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
