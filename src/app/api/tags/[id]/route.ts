import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { updateTagSchema, parseBody } from "@/lib/validations";
import { getSession, getVerifiedSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

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

    const tagInfo = await prisma.tag.findUnique({ where: { id }, select: { boardId: true } });
    if (!tagInfo) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: tagInfo.boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const raw = await request.json();
    const result = parseBody(updateTagSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
      },
    });

    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A tag with that name already exists on this board." }, { status: 409 });
    }
    console.error("Failed to update tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

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

    const tagToDelete = await prisma.tag.findUnique({ where: { id }, select: { boardId: true } });
    if (!tagToDelete) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: session.userId, boardId: tagToDelete.boardId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await prisma.tag.delete({
      where: { id },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
