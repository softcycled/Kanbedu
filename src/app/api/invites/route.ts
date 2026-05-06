import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// POST: create an invite link for a board
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { boardId } = await req.json();
    if (!boardId) {
      return NextResponse.json({ error: "boardId is required." }, { status: 400 });
    }

    // Verify user is a member of this board
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this board." }, { status: 403 });
    }

    // Create invite with 7-day expiration
    const invite = await prisma.boardInvite.create({
      data: {
        boardId,
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
