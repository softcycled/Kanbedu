import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createColumnSchema, reorderColumnsSchema, parseBody } from "@/lib/validations";

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

      const created = await Promise.all(
        defaultColumns.map((col) => prisma.column.create({ data: col }))
      );

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
    const { data, error } = parseBody(createColumnSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

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
    const { data, error } = parseBody(reorderColumnsSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const updated = await Promise.all(
      data.columns.map((col) =>
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
