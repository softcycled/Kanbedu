import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromGCS } from "@/lib/gcs";
import { del } from "@vercel/blob";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      url: true,
      uploadedBy: true,
      task: {
        select: {
          columnRel: {
            select: {
              board: {
                select: {
                  members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!attachment.task.columnRel?.board?.members?.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // url is a GCS object path for new uploads, or a legacy Vercel Blob URL
  if (attachment.url.startsWith("https://")) {
    await del(attachment.url);
  } else {
    await deleteFromGCS(attachment.url);
  }

  await prisma.attachment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
