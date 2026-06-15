import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createColumnSchema, reorderColumnsSchema, parseBody } from "@/lib/validations";
import { getSession, getVerifiedSession, isMemberOfBoard } from "@/lib/auth";
import { broadcastToBoard } from "@/lib/broadcast";
import { checkRateLimit } from "@/lib/rateLimit";

// GET columns (scoped by boardId)
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    if (!boardId) return NextResponse.json({ error: "boardId is required" }, { status: 400 });

    const allowed = await isMemberOfBoard(session.userId, boardId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { order: "asc" },
    });

    // If no columns exist for this board, create defaults
    if (columns.length === 0) {
      const defaultColumns = [
        { label: "To Do", order: 0, isDone: false, boardId },
        { label: "In Progress", order: 1, isDone: false, boardId },
        { label: "Done", order: 2, isDone: true, boardId },
      ];

      columns = await prisma.$transaction(async (tx) => {
        const recheck = await tx.column.findMany({ where: { boardId }, orderBy: { order: "asc" } });
        if (recheck.length > 0) return recheck; // another request already seeded
        await tx.column.createMany({ data: defaultColumns });
        return tx.column.findMany({ where: { boardId }, orderBy: { order: "asc" } });
      });
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
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const member = await isMemberOfBoard(session.userId, data.boardId);
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get max order for this board
    const maxOrder = await prisma.column.aggregate({
      where: { boardId: data.boardId },
      _max: { order: true },
    });

    const newOrder = (maxOrder._max.order || 0) + 1;

    const column = await prisma.column.create({
      data: { label: data.label, order: newOrder, boardId: data.boardId, color: data.color ?? null },
    });

    try {
      const broadcastBoard = await prisma.board.findUnique({
        where: { id: data.boardId },
        select: { realtimeSecret: true },
      });
      if (broadcastBoard?.realtimeSecret) await broadcastToBoard(broadcastBoard.realtimeSecret);
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

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
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

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

    try {
      const broadcastBoard = await prisma.board.findUnique({
        where: { id: boardId },
        select: { realtimeSecret: true },
      });
      if (broadcastBoard?.realtimeSecret) await broadcastToBoard(broadcastBoard.realtimeSecret);
    } catch (err) {
      console.error("Broadcast failed:", err);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to reorder columns:", error);
    return NextResponse.json(
      { error: "Failed to reorder columns" },
      { status: 500 }
    );
  }
}
