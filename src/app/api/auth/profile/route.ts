import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { profileUpdateSchema, parseBody } from "@/lib/validations";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const result = parseBody(profileUpdateSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const updateData: Record<string, string> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.handle !== undefined) {
      const existing = await prisma.user.findUnique({ where: { handle: data.handle } });
      if (existing && existing.id !== session.userId) {
        return NextResponse.json({ error: "That handle is already taken." }, { status: 409 });
      }
      updateData.handle = data.handle;
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: { id: true, email: true, name: true, color: true, handle: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
