import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// TEMPORARY endpoint — delete after use.
// GET /api/admin/promote-self  →  sets isAdmin = true for the currently logged-in user.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { isAdmin: true },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}
