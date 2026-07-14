import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";
import { randomUUID } from "crypto";

// POST: owner rotates the public view token, instantly invalidating any
// previously shared link without having to turn public view off entirely.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: id } },
    });
    if (!membership || membership.role !== "owner") {
      logAuthzDenied(request, "/api/boards/[id]/public-view/regenerate", session.userId, "POST owner-only");
      return NextResponse.json({ error: "Only the board owner can regenerate this link." }, { status: 403 });
    }

    const board = await prisma.board.update({
      where: { id },
      data: { publicViewToken: randomUUID() },
      select: { publicViewEnabled: true, publicViewToken: true },
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to regenerate public view link:", error);
    return NextResponse.json({ error: "Failed to regenerate public view link." }, { status: 500 });
  }
}
