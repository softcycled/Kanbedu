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
      // Exclude class group boards — those live under Classes, not personal Boards.
      where: { userId: session.userId, board: { group: { is: null } } },
      include: { board: true },
      orderBy: { board: { order: "asc" } },
    });

    let boards = memberships.map((m) => m.board);

    // First-time user: create a default board and add them as owner
    if (boards.length === 0) {
      const board = await prisma.$transaction(async (tx) => {
        const created = await tx.board.create({ data: { name: "My Board" } });
        await tx.boardMember.create({
          data: { userId: session.userId, boardId: created.id, role: "owner" },
        });
        await tx.column.createMany({
          data: [
            { label: "To Do", order: 0, isDone: false, boardId: created.id },
            { label: "In Progress", order: 1, isDone: false, boardId: created.id },
            { label: "Done", order: 2, isDone: true, boardId: created.id },
          ],
        });
        return created;
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
    const result = parseBody(createBoardSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const memberCount = await prisma.boardMember.count({
      where: { userId: session.userId },
    });

    const board = await prisma.$transaction(async (tx) => {
      const created = await tx.board.create({
        data: { name: data.name, order: memberCount },
      });
      await tx.boardMember.create({
        data: { userId: session.userId, boardId: created.id, role: "owner" },
      });
      await tx.column.createMany({
        data: [
          { label: "To Do", order: 0, isDone: false, boardId: created.id },
          { label: "In Progress", order: 1, isDone: false, boardId: created.id },
          { label: "Done", order: 2, isDone: true, boardId: created.id },
        ],
      });
      return created;
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
    const result = parseBody(reorderBoardsSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // auth: ensure user is authenticated and is a member of all affected boards
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const memberships = await prisma.boardMember.findMany({
      where: { userId: session.userId, boardId: { in: data.ids } },
      select: { boardId: true },
    });
    const memberBoardIds = memberships.map((m) => m.boardId);
    const missing = data.ids.filter((id: string) => !memberBoardIds.includes(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
