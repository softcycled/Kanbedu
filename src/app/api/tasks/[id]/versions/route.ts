import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const versions = await prisma.taskDescriptionVersion.findMany({
    where: { taskId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(versions);
}
