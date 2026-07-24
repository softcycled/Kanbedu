import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// GET: unauthenticated read-only board view. No session required — this is
// the whole point. Only returns task name, description, deadline, priority,
// phase, and tags. Never assignees, comments, attachments, or timestamps
// beyond deadline — this link has no login wall, so it never exposes who
// did what or when.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip, "public_board_view", 60, 5);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const board = await prisma.board.findUnique({
      where: { publicViewToken: token },
      select: {
        id: true,
        name: true,
        publicViewEnabled: true,
        columns: {
          orderBy: { order: "asc" },
          select: { id: true, label: true, order: true, isDone: true, isStart: true, color: true },
        },
      },
    });

    if (!board || !board.publicViewEnabled) {
      return NextResponse.json({ error: "This board isn't available for public viewing." }, { status: 404 });
    }

    const tasks = await prisma.task.findMany({
      where: { columnRel: { boardId: board.id }, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        deadline: true,
        priority: true,
        column: true,
        order: true,
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
    });

    return NextResponse.json({
      boardName: board.name,
      columns: board.columns,
      tasks,
    });
  } catch (error) {
    console.error("Failed to load public board view:", error);
    return NextResponse.json({ error: "Failed to load board." }, { status: 500 });
  }
}
