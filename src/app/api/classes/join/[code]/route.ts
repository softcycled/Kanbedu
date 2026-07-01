import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFull } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// GET: validate a class join code without joining. Returns the class name.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimit(ip, "class_join_check", 300, 15);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

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

// POST: join a class as a student. If the caller's email matches a roster
// entry with a group, they're placed in that group (and granted its board);
// otherwise they land in the lobby for the educator to sort later.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const session = await getSessionFull();
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

    // Check if this user's email matches a roster entry — set displayName + groupId if so
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    const normalizedEmail = user?.email?.toLowerCase().trim() ?? "";

    const rosterEntry = normalizedEmail
      ? await prisma.classRosterEntry.findUnique({
          where: { classId_email: { classId: cls.id, email: normalizedEmail } },
        })
      : null;

    // Students who were invited by email already proved they own the address —
    // the invite email IS the verification. Everyone else still needs emailVerified.
    if (!session.emailVerified && !rosterEntry) {
      return NextResponse.json({ error: "Please verify your email to join a class.", code: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }

    let groupId: string | null = null;
    let groupBoardId: string | null = null;
    if (rosterEntry?.groupName) {
      const group = await prisma.group.findFirst({
        where: { classId: cls.id, name: { equals: rosterEntry.groupName, mode: "insensitive" } },
        select: { id: true, boardId: true },
      });
      groupId = group?.id ?? null;
      groupBoardId = group?.boardId ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.classMember.create({
        data: {
          userId: session.userId,
          classId: cls.id,
          role: "student",
          ...(rosterEntry ? { displayName: rosterEntry.name } : {}),
          ...(groupId ? { groupId } : {}),
        },
      });

      // Grant board access so the student can load their group's board immediately.
      if (groupBoardId) {
        await tx.boardMember.upsert({
          where: { userId_boardId: { userId: session.userId, boardId: groupBoardId } },
          update: {},
          create: { userId: session.userId, boardId: groupBoardId, role: "member" },
        });
      }

      // Mark the roster entry as claimed
      if (rosterEntry) {
        await tx.classRosterEntry.update({
          where: { classId_email: { classId: cls.id, email: normalizedEmail } },
          data: { claimedBy: session.userId },
        });
      }

      // Auto-verify the email — receiving and clicking the invite already proved
      // they own this address, so no separate verification step is needed.
      if (!session.emailVerified && rosterEntry) {
        await tx.user.update({
          where: { id: session.userId },
          data: { emailVerified: true },
        });
      }
    });

    return NextResponse.json({ message: "You have joined the class.", classId: cls.id, name: cls.name });
  } catch (error) {
    console.error("Failed to join class.", error);
    return NextResponse.json({ error: "Failed to join class." }, { status: 500 });
  }
}
