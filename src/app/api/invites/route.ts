import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { createInviteSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

// POST: create an invite link for a board
export async function POST(req: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const rl = await checkRateLimit(session.userId, "invites_create", 20, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const raw = await req.json();
    const result = parseBody(createInviteSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // Verify user is the owner of this board (members cannot mint invites)
    const [membership, groupBoard] = await Promise.all([
      prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: session.userId, boardId: data.boardId } },
      }),
      prisma.group.findFirst({
        where: { boardId: data.boardId },
        select: { id: true },
      }),
    ]);
    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Only the board owner can create invite links." }, { status: 403 });
    }
    if (groupBoard) {
      return NextResponse.json({ error: "Invite links are not available for class group boards." }, { status: 403 });
    }

    // Create invite with 7-day expiration
    const invite = await prisma.boardInvite.create({
      data: {
        boardId: data.boardId,
        createdBy: session.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ token: invite.token }, { status: 201 });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }
}
