import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH update column (rename, set done)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { label, isDone } = body;

    if (label !== undefined && (typeof label !== "string" || !label.trim())) {
      return NextResponse.json(
        { error: "Label must be a non-empty string" },
        { status: 400 }
      );
    }

    const updateData: { label?: string; isDone?: boolean } = {};
    if (label !== undefined) updateData.label = label.trim();
    if (isDone !== undefined) updateData.isDone = Boolean(isDone);

    // Enforce only one done column per board: clear isDone on all siblings first,
    // and clear completedAt on any tasks that were in those sibling "done" columns.
    if (updateData.isDone === true) {
      const current = await prisma.column.findUnique({ where: { id: params.id } });
      if (current) {
        // Find sibling done columns before clearing them
        const siblingDoneColumns = await prisma.column.findMany({
          where: { boardId: current.boardId, id: { not: params.id }, isDone: true },
          select: { id: true },
        });
        const siblingIds = siblingDoneColumns.map((c) => c.id);

        await prisma.column.updateMany({
          where: { boardId: current.boardId, id: { not: params.id } },
          data: { isDone: false },
        });

        // Tasks that were in the old done columns are now "active" — clear completedAt
        if (siblingIds.length > 0) {
          await prisma.task.updateMany({
            where: { column: { in: siblingIds } },
            data: { completedAt: null },
          });
        }

        // Mark all current tasks in THIS column as completed now
        await prisma.task.updateMany({
          where: { column: params.id },
          data: { completedAt: new Date() },
        });
      }
    }

    // If un-marking a done column, clear completedAt on all its tasks
    if (updateData.isDone === false) {
      await prisma.task.updateMany({
        where: { column: params.id },
        data: { completedAt: null },
      });
    }

    const column = await prisma.column.update({
      where: { id: params.id },
      data: updateData,
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

    // If moveToColumnId provided, move all tasks to that column.
    // If the deleted column was Done but the destination is not, also clear completedAt.
    if (moveToColumnId) {
      const [deletingColumn, destColumn] = await Promise.all([
        prisma.column.findUnique({ where: { id: params.id } }),
        prisma.column.findUnique({ where: { id: moveToColumnId } }),
      ]);

      const clearCompleted = deletingColumn?.isDone && !destColumn?.isDone;

      await prisma.task.updateMany({
        where: { column: params.id },
        data: {
          column: moveToColumnId,
          ...(clearCompleted ? { completedAt: null } : {}),
        },
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
