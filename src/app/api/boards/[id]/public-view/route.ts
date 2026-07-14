import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { setPublicViewSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthzDenied } from "@/lib/securityLog";

// PATCH: owner toggles public view on/off for a personal board.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const raw = await request.json();
    const result = parseBody(setPublicViewSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    const [membership, groupBoard] = await Promise.all([
      prisma.boardMember.findUnique({ where: { userId_boardId: { userId: session.userId, boardId: id } } }),
      prisma.group.findUnique({ where: { boardId: id }, select: { id: true } }),
    ]);
    if (!membership || membership.role !== "owner") {
      logAuthzDenied(request, "/api/boards/[id]/public-view", session.userId, "PATCH owner-only");
      return NextResponse.json({ error: "Only the board owner can change this." }, { status: 403 });
    }
    // Public view is a personal-board feature only. Class group boards are
    // scoped to their class roster; no anonymous public link for those.
    if (groupBoard) {
      return NextResponse.json({ error: "Public view links are not available for class group boards." }, { status: 403 });
    }

    const board = await prisma.board.update({
      where: { id },
      data: { publicViewEnabled: result.data.enabled },
      select: { publicViewEnabled: true, publicViewToken: true },
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to update public view setting:", error);
    return NextResponse.json({ error: "Failed to update public view setting." }, { status: 500 });
  }
}
