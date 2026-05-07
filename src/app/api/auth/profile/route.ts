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
    const { data, error } = parseBody(profileUpdateSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: { id: true, email: true, name: true, color: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
