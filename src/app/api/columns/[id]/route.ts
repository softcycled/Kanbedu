import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateColumnSchema, deleteColumnSchema, parseBody } from "@/lib/validations";
import { getSession, getVerifiedSession } from "@/lib/auth";
import { broadcastToBoard } from "@/lib/broadcast";
import { checkRateLimit } from "@/lib/rateLimit";

// PATCH update column (rename, set done)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    // Check the user is a member of the board that owns this column
    // include `isDone` so we can enforce "always have a done column" rules
    const columnInfo = await prisma.column.findUnique({ where: { id: id }, select: { boardId: true, isDone: true } });
    if (!columnInfo) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: columnInfo.boardId } },
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

    if (data.isDone !== undefined && membership.role !== "owner") {
      return NextResponse.json({ error: "Only board owners can change the done column." }, { status: 403 });
    }

    const updateData: { label?: string; isDone?: boolean; color?: string | null } = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.isDone !== undefined) updateData.isDone = data.isDone;
    if (data.color !== undefined) updateData.color = data.color;

    // Enforce only one done column per board: clear isDone on all siblings first,
    // and clear completedAt on any tasks that were in those sibling "done" columns.
    if (updateData.isDone === true) {
      const current = await prisma.column.findUnique({ where: { id: id } });
      if (current) {
        // Find sibling done columns before clearing them
        const siblingDoneColumns = await prisma.column.findMany({
          where: { boardId: current.boardId, id: { not: id }, isDone: true },
          select: { id: true },
        });
        const siblingIds = siblingDoneColumns.map((c) => c.id);

        await prisma.column.updateMany({
          where: { boardId: current.boardId, id: { not: id } },
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
          where: { column: id },
          data: { completedAt: new Date() },
        });
      }
    }

    // If un-marking a done column, ensure the board will still have a done column
    if (updateData.isDone === false && columnInfo.isDone === true) {
      const otherDone = await prisma.column.findFirst({ where: { boardId: columnInfo.boardId, id: { not: id }, isDone: true }, select: { id: true } });
      if (!otherDone) {
        return NextResponse.json({ error: "Board must have at least one 'Done' column. Mark another column as done before un-marking this one." }, { status: 400 });
      }
      await prisma.task.updateMany({
        where: { column: id },
        data: { completedAt: null },
      });
    }

    const column = await prisma.column.update({
      where: { id: id },
      data: updateData,
    });

    try {
      const broadcastBoard = await prisma.board.findUnique({
        where: { id: columnInfo.boardId },
        select: { realtimeSecret: true },
      });
      if (broadcastBoard?.realtimeSecret) await broadcastToBoard(broadcastBoard.realtimeSecret);
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    // Check the user is a member of the board that owns this column
    // include `isDone` so we can enforce the "always-have-a-done-column" invariant
    const col = await prisma.column.findUnique({ where: { id: id }, select: { boardId: true, isDone: true } });
    if (!col) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: col.boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (membership.role !== "owner") {
      return NextResponse.json({ error: "Only board owners can delete columns." }, { status: 403 });
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
    // Check whether deleting this column would remove the board's only done column
    const otherDone = await prisma.column.findFirst({ where: { boardId: col.boardId, id: { not: id }, isDone: true }, select: { id: true } });

    let deletedCol;

    if (moveToColumnId) {
      const [deletingColumn, destColumn] = await Promise.all([
        prisma.column.findUnique({ where: { id: id } }),
        prisma.column.findUnique({ where: { id: moveToColumnId } }),
      ]);

      if (!deletingColumn) {
        return NextResponse.json({ error: "Column not found" }, { status: 404 });
      }

      if (!destColumn) {
        return NextResponse.json({ error: "Destination column not found" }, { status: 404 });
      }

      // Prevent cross-board moves
      if (destColumn.boardId !== deletingColumn.boardId) {
        return NextResponse.json({ error: "Destination column must belong to the same board" }, { status: 400 });
      }

      // If deleting a done column, ensure the board will still have a done column
      if (deletingColumn.isDone) {
        if (!otherDone && !destColumn.isDone) {
          return NextResponse.json({ error: "Cannot delete the only 'Done' column. Mark another column as done or move tasks to a done column first." }, { status: 400 });
        }
      }

      const clearCompleted = deletingColumn?.isDone && !destColumn?.isDone;

      // WRAP IN TRANSACTION
      const [_, deleted] = await prisma.$transaction([
        prisma.task.updateMany({
          where: { column: id },
          data: {
            column: moveToColumnId,
            ...(clearCompleted ? { completedAt: null } : {}),
          },
        }),
        prisma.column.delete({
          where: { id: id },
        })
      ]);
      deletedCol = deleted;
    } else {
      // No destination; if this is a done column and there are no other done columns, forbid deletion
      if (col.isDone && !otherDone) {
        return NextResponse.json({ error: "Cannot delete the only 'Done' column. Mark another column as done before deleting this one." }, { status: 400 });
      }
      // Delete tasks (and their cascaded relations) then the column, all in one transaction
      const [, deleted] = await prisma.$transaction([
        prisma.task.deleteMany({ where: { column: id } }),
        prisma.column.delete({ where: { id } }),
      ]);
      deletedCol = deleted;
    }

    try {
      const broadcastBoard = await prisma.board.findUnique({
        where: { id: col.boardId },
        select: { realtimeSecret: true },
      });
      if (broadcastBoard?.realtimeSecret) await broadcastToBoard(broadcastBoard.realtimeSecret);
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

    return NextResponse.json(deletedCol);
  } catch (error) {
    console.error("Failed to delete column:", error);
    return NextResponse.json(
      { error: "Failed to delete column" },
      { status: 500 }
    );
  }
}
