import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateBoardSchema, parseBody } from "@/lib/validations";

// PATCH update board
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const raw = await request.json();
    const result = parseBody(updateBoardSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const board = await prisma.board.update({
      where: { id: params.id },
      data: { 
        name: data.name,
        githubRepo: data.githubRepo 
      },
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
