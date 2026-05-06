import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// POST: accept an invite (add user to board)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const invite = await prisma.boardInvite.findUnique({
      where: { token: params.token },
      include: { board: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite link." }, { status: 404 });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: "This invite link has expired." }, { status: 410 });
    }

    // Check if already a member
    const existing = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: invite.boardId } },
    });

    if (existing) {
      return NextResponse.json({
        message: "You are already a member of this board.",
        boardId: invite.boardId,
        boardName: invite.board.name,
      });
    }

    // Add user as member
    await prisma.boardMember.create({
      data: { userId: session.userId, boardId: invite.boardId, role: "member" },
    });

    return NextResponse.json({
      message: "You have joined the board.",
      boardId: invite.boardId,
      boardName: invite.board.name,
    });
  } catch (error) {
    console.error("Failed to accept invite:", error);
    return NextResponse.json({ error: "Failed to accept invite." }, { status: 500 });
  }
}

// GET: check invite validity without accepting
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await prisma.boardInvite.findUnique({
      where: { token: params.token },
      include: { board: { select: { name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite link." }, { status: 404 });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: "This invite link has expired." }, { status: 410 });
    }

    return NextResponse.json({
      boardName: invite.board.name,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to check invite:", error);
    return NextResponse.json({ error: "Failed to check invite." }, { status: 500 });
  }
}
