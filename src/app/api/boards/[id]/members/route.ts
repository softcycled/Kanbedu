import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Ensure the user is a member of this board before returning its members
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: params.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized access to board members." }, { status: 403 });
    }

    const members = await prisma.boardMember.findMany({
      where: { boardId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, color: true },
        },
      },
    });

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
