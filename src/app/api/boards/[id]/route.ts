import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateBoardSchema, parseBody } from "@/lib/validations";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

// PATCH update board
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const raw = await request.json();
    const result = parseBody(updateBoardSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const board = await prisma.board.update({
      where: { id },
      data: {
        name: data.name,
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: id } },
    });
    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const columns = await prisma.column.findMany({
      where: { boardId: id },
      select: { id: true },
    });

    const columnIds = columns.map((c) => c.id);

    if (columnIds.length > 0) {
      await prisma.comment.deleteMany({
        where: { task: { column: { in: columnIds } } },
      });
      await prisma.task.deleteMany({ where: { column: { in: columnIds } } });
      await prisma.column.deleteMany({ where: { boardId: id } });
    }

    await prisma.board.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete board:", error);
    return NextResponse.json({ error: "Failed to delete board" }, { status: 500 });
  }
}
