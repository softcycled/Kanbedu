import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession } from "@/lib/auth";

// Status Update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { status } = body as { status?: string };
    if (!["open", "in-progress", "resolved"].includes(status ?? "")) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const report = await prisma.bugReport.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Admin report update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Permanent Deletion
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.bugReport.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin report deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
