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

    // Fetch all members in one query, then check if caller is among them
    const members = await prisma.boardMember.findMany({
      where: { boardId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, color: true },
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
