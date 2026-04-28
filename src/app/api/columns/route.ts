import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET all columns
export async function GET() {
  try {
    const columns = await prisma.column.findMany({
      orderBy: { order: "asc" },
    });

    // If no columns exist, create default ones
    if (columns.length === 0) {
      const defaultColumns = [
        { label: "To Do", order: 0, isDone: false },
        { label: "In Progress", order: 1, isDone: false },
        { label: "Done", order: 2, isDone: true },
      ];

      const created = await Promise.all(
        defaultColumns.map((col) =>
          prisma.column.create({ data: col })
        )
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
    const { label } = await request.json();

    if (!label || typeof label !== "string") {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Get max order
    const maxOrder = await prisma.column.aggregate({
      _max: { order: true },
    });

    const newOrder = (maxOrder._max.order || 0) + 1;

    const column = await prisma.column.create({
      data: {
        label,
        order: newOrder,
      },
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
    const { columns } = await request.json();

    if (!Array.isArray(columns)) {
      return NextResponse.json(
        { error: "Columns array is required" },
        { status: 400 }
      );
    }

    // Update order for each column
    const updated = await Promise.all(
      columns.map((col: { id: string; order: number }) =>
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
