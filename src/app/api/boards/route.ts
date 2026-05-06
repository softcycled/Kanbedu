import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createBoardSchema, reorderBoardsSchema, parseBody } from "@/lib/validations";

// GET all boards the current user is a member of
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const memberships = await prisma.boardMember.findMany({
      where: { userId: session.userId },
      include: { board: true },
      orderBy: { board: { order: "asc" } },
    });

    let boards = memberships.map((m) => m.board);

    // First-time user: create a default board and add them as owner
    if (boards.length === 0) {
      const board = await prisma.board.create({
        data: { name: "My Board" },
      });
      await prisma.boardMember.create({
        data: { userId: session.userId, boardId: board.id, role: "owner" },
      });
      await prisma.column.createMany({
        data: [
          { label: "To Do", order: 0, isDone: false, boardId: board.id },
          { label: "In Progress", order: 1, isDone: false, boardId: board.id },
          { label: "Done", order: 2, isDone: true, boardId: board.id },
        ],
      });
      boards = [board];
    }

    return NextResponse.json(boards);
  } catch (error) {
    console.error("Failed to fetch boards:", error);
    return NextResponse.json({ error: "Failed to fetch boards" }, { status: 500 });
  }
}

// POST create a new board (with default columns) and add creator as owner
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const raw = await request.json();
    const { data, error } = parseBody(createBoardSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const memberCount = await prisma.boardMember.count({
      where: { userId: session.userId },
    });

    const board = await prisma.board.create({
      data: { name: data.name, order: memberCount },
    });

    // Auto-add creator as owner
    await prisma.boardMember.create({
      data: { userId: session.userId, boardId: board.id, role: "owner" },
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

// PUT reorder boards -- body: { ids: string[] } in desired order
export async function PUT(request: NextRequest) {
  try {
    const raw = await request.json();
    const { data, error } = parseBody(reorderBoardsSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    await Promise.all(
      data.ids.map((id: string, index: number) =>
        prisma.board.update({ where: { id }, data: { order: index } })
      )
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder boards:", error);
    return NextResponse.json({ error: "Failed to reorder boards" }, { status: 500 });
  }
}
