import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createTagSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json({ error: "Board ID is required" }, { status: 400 });
    }

    const tags = await prisma.tag.findMany({
      where: { boardId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const result = parseBody(createTagSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // auth: ensure user is signed in and member of the board
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const board = await prisma.board.findUnique({ where: { id: data.boardId } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const allowed = await isMemberOfBoard(session.userId, data.boardId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        color: data.color,
        boardId: data.boardId,
      },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
