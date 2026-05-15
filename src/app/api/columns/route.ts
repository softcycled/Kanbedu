import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createColumnSchema, reorderColumnsSchema, parseBody } from "@/lib/validations";
import { getSession, isMemberOfBoard } from "@/lib/auth";

// GET columns (optionally scoped by boardId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    const where = boardId ? { boardId } : {};

    const columns = await prisma.column.findMany({
      where,
      orderBy: { order: "asc" },
    });

    // If no columns exist for this board, create defaults
    if (columns.length === 0 && boardId) {
      const defaultColumns = [
        { label: "To Do", order: 0, isDone: false, boardId },
        { label: "In Progress", order: 1, isDone: false, boardId },
        { label: "Done", order: 2, isDone: true, boardId },
      ];

      await prisma.column.createMany({ data: defaultColumns });
      const created = await prisma.column.findMany({
        where: { boardId },
        orderBy: { order: "asc" },
      });

      return NextResponse.json(created);
    }

    return NextResponse.json(columns);
  } catch (error) {
    console.error("Failed to fetch columns:", error);
    return NextResponse.json(
      { error: "Failed to fetch columns" },
      { status: 500 }
    );
  }
}

// POST create new column
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const result = parseBody(createColumnSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // auth: ensure user is signed in and is a member of the board
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const member = await isMemberOfBoard(session.userId, data.boardId);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get max order for this board
    const maxOrder = await prisma.column.aggregate({
      where: { boardId: data.boardId },
      _max: { order: true },
    });

    const newOrder = (maxOrder._max.order || 0) + 1;

    const column = await prisma.column.create({
      data: { label: data.label, order: newOrder, boardId: data.boardId },
    });

    return NextResponse.json(column, { status: 201 });
  } catch (error) {
    console.error("Failed to create column:", error);
    return NextResponse.json(
      { error: "Failed to create column" },
      { status: 500 }
    );
  }
}

// PATCH reorder columns
export async function PATCH(request: NextRequest) {
  try {
    const raw = await request.json();
    const result = parseBody(reorderColumnsSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // auth: ensure user is signed in and is a member of the affected board
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const colIds = data.columns.map((c: any) => c.id);
    const cols = await prisma.column.findMany({ where: { id: { in: colIds } }, select: { id: true, boardId: true } });
    if (cols.length !== colIds.length) {
      return NextResponse.json({ error: "One or more columns not found" }, { status: 404 });
    }

    const boardIds = Array.from(new Set(cols.map((c) => c.boardId)));
    if (boardIds.length !== 1) {
      return NextResponse.json({ error: "Columns must belong to the same board" }, { status: 400 });
    }

    const boardId = boardIds[0];
    const allowed = await isMemberOfBoard(session.userId, boardId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.$transaction(
      data.columns.map((col: any) =>
        prisma.column.update({
          where: { id: col.id },
          data: { order: col.order },
        })
      )
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to reorder columns:", error);
    return NextResponse.json(
      { error: "Failed to reorder columns" },
      { status: 500 }
    );
  }
}
