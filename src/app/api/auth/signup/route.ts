import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { signupSchema, parseBody } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const { data, error } = parseBody(signupSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hashed = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, password: hashed, name: data.name },
    });

    await createSession(user.id);

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
