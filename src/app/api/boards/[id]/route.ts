import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH rename board
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const board = await prisma.board.update({
      where: { id: params.id },
      data: { name: name.trim() },
    });

    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to rename board:", error);
    return NextResponse.json({ error: "Failed to rename board" }, { status: 500 });
  }
}

// DELETE board (cascade columns + tasks)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const columns = await prisma.column.findMany({
      where: { boardId: params.id },
      select: { id: true },
    });

    const columnIds = columns.map((c) => c.id);

    if (columnIds.length > 0) {
      // Delete comments first (cascade isn't set on task delete for us)
      await prisma.comment.deleteMany({
        where: { task: { column: { in: columnIds } } },
      });
      await prisma.task.deleteMany({ where: { column: { in: columnIds } } });
      await prisma.column.deleteMany({ where: { boardId: params.id } });
    }

    await prisma.board.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete board:", error);
    return NextResponse.json({ error: "Failed to delete board" }, { status: 500 });
  }
}
