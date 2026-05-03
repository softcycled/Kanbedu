import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BOARD_ID = "cldefaultboard0000";

// GET all boards
export async function GET() {
  try {
    let boards = await prisma.board.findMany({ orderBy: { createdAt: "asc" } });

    if (boards.length === 0) {
      const board = await prisma.board.create({
        data: { id: DEFAULT_BOARD_ID, name: "My Board" },
      });
      boards = [board];
    }

    return NextResponse.json(boards);
  } catch (error) {
    console.error("Failed to fetch boards:", error);
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}

// POST create a new board (with default columns)
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const board = await prisma.board.create({ data: { name: name.trim() } });

    await prisma.column.createMany({
      data: [
        { label: "To Do", order: 0, isDone: false, boardId: board.id },
        { label: "In Progress", order: 1, isDone: false, boardId: board.id },
        { label: "Done", order: 2, isDone: true, boardId: board.id },
      ],
    });

    return NextResponse.json(board, { status: 201 });
  } catch (error) {
    console.error("Failed to create board:", error);
    return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
  }
}
