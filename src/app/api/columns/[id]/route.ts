import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH update column (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { label } = await request.json();

    if (!label || typeof label !== "string") {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    const column = await prisma.column.update({
      where: { id: params.id },
      data: { label },
    });

    return NextResponse.json(column);
  } catch (error) {
    console.error("Failed to update column:", error);
    return NextResponse.json(
      { error: "Failed to update column" },
      { status: 500 }
    );
  }
}

// DELETE delete column
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Parse request body, handle empty body
    let moveToColumnId: string | null = null;
    try {
      const body = await request.json();
      moveToColumnId = body.moveToColumnId || null;
    } catch {
      // Empty or invalid body is ok for DELETE
    }

    // If moveToColumnId provided, move all tasks to that column
    if (moveToColumnId) {
      // Find all tasks in this column and move them
      await prisma.task.updateMany({
        where: { column: params.id },
        data: { column: moveToColumnId },
      });
    }

    // Delete the column
    const deleted = await prisma.column.delete({
      where: { id: params.id },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete column:", error);
    return NextResponse.json(
      { error: "Failed to delete column", details: String(error) },
      { status: 500 }
    );
  }
}
