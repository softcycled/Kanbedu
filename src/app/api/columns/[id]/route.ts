import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateColumnSchema, deleteColumnSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";

// PATCH update column (rename, set done)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check the user is a member of the board that owns this column
    const column = await prisma.column.findUnique({ where: { id: params.id }, select: { boardId: true } });
    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: column.boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const raw = await request.json();
    const result = parseBody(updateColumnSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const updateData: { label?: string; isDone?: boolean } = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.isDone !== undefined) updateData.isDone = data.isDone;

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

        // Tasks that were in the old done columns are now "active" -- clear completedAt
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check the user is a member of the board that owns this column
    const col = await prisma.column.findUnique({ where: { id: params.id }, select: { boardId: true } });
    if (!col) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: col.boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body, handle empty body
    let moveToColumnId: string | null = null;
    try {
      const raw = await request.json();
      const { data } = parseBody(deleteColumnSchema, raw);
      if (data) {
        moveToColumnId = data.moveToColumnId ?? null;
      }
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
