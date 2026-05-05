import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BOARD_ID = "cldefaultboard0000";

// GET all boards
export async function GET() {
  try {
    let boards = await prisma.board.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });

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

    const existing = await prisma.board.findMany({ select: { id: true } });
    const board = await prisma.board.create({
      data: { name: name.trim(), order: existing.length },
    });

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

// PUT reorder boards — body: { ids: string[] } in desired order
export async function PUT(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
    }
    await Promise.all(
      ids.map((id: string, index: number) =>
        prisma.board.update({ where: { id }, data: { order: index } })
      )
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder boards:", error);
    return NextResponse.json({ error: "Failed to reorder boards" }, { status: 500 });
  }
}
