import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

// GET: validate a class join code without joining. Returns the class name.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const cls = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { id: true, name: true, term: true, archived: true },
    });
    if (!cls) return NextResponse.json({ error: "Invalid class code." }, { status: 404 });
    if (cls.archived) return NextResponse.json({ error: "This class is no longer accepting members." }, { status: 410 });

    return NextResponse.json({ name: cls.name, term: cls.term });
  } catch (error) {
    console.error("Failed to check class code:", error);
    return NextResponse.json({ error: "Failed to check class code." }, { status: 500 });
  }
}

// POST: join a class as a student. Lands the caller in the lobby (no group);
// the educator sorts them into a group afterwards.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const limit = await checkRateLimit(session.userId, "class-join", 30, 60);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many join attempts. Try again later." }, { status: 429 });
    }

    const cls = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { id: true, name: true, archived: true },
    });
    if (!cls) return NextResponse.json({ error: "Invalid class code." }, { status: 404 });
    if (cls.archived) return NextResponse.json({ error: "This class is no longer accepting members." }, { status: 410 });

    const existing = await prisma.classMember.findUnique({
      where: { userId_classId: { userId: session.userId, classId: cls.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ message: "You are already in this class.", classId: cls.id, name: cls.name });
    }

    await prisma.classMember.create({
      data: { userId: session.userId, classId: cls.id, role: "student" },
    });

    return NextResponse.json({ message: "You have joined the class.", classId: cls.id, name: cls.name });
  } catch (error) {
    console.error("Failed to join class:", error);
    return NextResponse.json({ error: "Failed to join class." }, { status: 500 });
  }
}
