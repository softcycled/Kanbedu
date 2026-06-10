import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { passwordChangeSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rl = await checkRateLimit(session.userId, "auth_password", 5, 15);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = parseBody(passwordChangeSchema, raw);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { currentPassword, newPassword } = result.data;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (!user.password) {
    return NextResponse.json({ error: "This account has no password set." }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: session.userId }, data: { password: hashed, passwordChangedAt: new Date() } as any });

  return NextResponse.json({ ok: true });
}
