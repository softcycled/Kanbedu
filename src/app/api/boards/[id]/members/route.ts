import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { transferOwnershipSchema, removeMemberSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Fetch all members in one query, then check if caller is among them
    const members = await prisma.boardMember.findMany({
      where: { boardId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, color: true, handle: true },
        },
      },
    });

    const isMember = members.some((m) => m.userId === session.userId);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized access to board members." }, { status: 403 });
    }

    const formattedMembers = members.map((m) => ({ ...m.user, role: m.role }));

    return NextResponse.json(formattedMembers);
  } catch (error) {
    console.error("Failed to fetch board members:", error);
    return NextResponse.json(
      { error: "Failed to fetch board members" },
      { status: 500 }
    );
  }
}

// POST: actions on members (e.g. transfer ownership)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const parsed = parseBody(transferOwnershipSchema, raw);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { toUserId } = parsed.data;

    const requester = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: id } },
    });
    if (!requester || requester.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (toUserId === session.userId) {
      return NextResponse.json({ error: "Cannot transfer ownership to yourself." }, { status: 400 });
    }

    const target = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: toUserId, boardId: id } },
    });
    if (!target) {
      return NextResponse.json({ error: "Target user is not a member." }, { status: 400 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "Target is already owner." }, { status: 400 });
    }

    // Atomic swap: promote target, demote requester
    await prisma.$transaction([
      prisma.boardMember.update({ where: { id: target.id }, data: { role: "owner" } }),
      prisma.boardMember.update({ where: { id: requester.id }, data: { role: "member" } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to perform member action:", error);
    return NextResponse.json({ error: "Failed to perform member action" }, { status: 500 });
  }
}

// DELETE: leave board or remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      rawBody = {};
    }
    const parsedBody = parseBody(removeMemberSchema, rawBody);
    const targetUserId = parsedBody.data?.userId || session.userId;

    const requester = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: id } },
    });
    if (!requester) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Leaving self
    if (targetUserId === session.userId) {
      if (requester.role === "owner") {
        return NextResponse.json({ error: "Owner cannot leave board without transferring ownership." }, { status: 403 });
      }

      await prisma.boardMember.delete({ where: { userId_boardId: { userId: session.userId, boardId: id } } });
      return NextResponse.json({ success: true });
    }

    // Removing another member — only owner allowed
    if (requester.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: targetUserId, boardId: id } },
    });
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (target.role === "owner") return NextResponse.json({ error: "Cannot remove owner. Transfer first." }, { status: 400 });

    await prisma.boardMember.delete({ where: { userId_boardId: { userId: targetUserId, boardId: id } } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete member:", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 });
  }
}
