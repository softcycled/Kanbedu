import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession, getVerifiedSession } from "@/lib/auth";

export async function GET() {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        taskId: true,
        boardId: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: session.userId, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : null;

  if (ids?.length) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, id: { in: ids } },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
