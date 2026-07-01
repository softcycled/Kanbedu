import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedSession, verifyPassword, destroySession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { del } from "@vercel/blob";
import { deleteFromGCS } from "@/lib/gcs";

export async function DELETE(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rl = await checkRateLimit(session.userId, "account_delete", 3, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let password: string;
  try {
    const body = await req.json();
    if (!body?.password || typeof body.password !== "string") {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, password: true },
  });

  if (!user || !user.password) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  }

  // Block if user owns any classes — must delete them first
  const ownedClassCount = await prisma.class.count({ where: { ownerId: session.userId } });
  if (ownedClassCount > 0) {
    return NextResponse.json(
      { error: "Please delete all your classes before deleting your account." },
      { status: 409 }
    );
  }

  // Collect all attachment URLs before any deletions (cascade later removes DB records but not blobs)
  const attachmentUrls = (
    await prisma.attachment.findMany({
      where: { uploadedBy: session.userId },
      select: { url: true },
    })
  ).map((a) => a.url);

  // Handle personal boards where this user is the owner
  const ownedMemberships = await prisma.boardMember.findMany({
    where: { userId: session.userId, role: "owner" },
    select: { boardId: true },
  });

  for (const { boardId } of ownedMemberships) {
    // Skip class group boards — those can't exist here (classes blocked above) but guard anyway
    const group = await prisma.group.findUnique({ where: { boardId }, select: { id: true } });
    if (group) continue;

    const otherMembers = await prisma.boardMember.findMany({
      where: { boardId, userId: { not: session.userId } },
      orderBy: { id: "asc" },
      take: 1,
    });

    if (otherMembers.length > 0) {
      // Transfer ownership to the next member so the board survives
      await prisma.boardMember.update({
        where: { id: otherMembers[0].id },
        data: { role: "owner" },
      });
    } else {
      // Sole member — delete the entire board with all its content
      const columns = await prisma.column.findMany({
        where: { boardId },
        select: { id: true },
      });
      const columnIds = columns.map((c) => c.id);

      if (columnIds.length > 0) {
        const taskIds = (
          await prisma.task.findMany({
            where: { column: { in: columnIds } },
            select: { id: true },
          })
        ).map((t) => t.id);

        await prisma.comment.deleteMany({ where: { task: { column: { in: columnIds } } } });
        if (taskIds.length > 0) {
          await prisma.notification.deleteMany({ where: { taskId: { in: taskIds } } });
        }
        await prisma.task.deleteMany({ where: { column: { in: columnIds } } });
        await prisma.column.deleteMany({ where: { boardId } });
      }

      await prisma.board.delete({ where: { id: boardId } });
    }
  }

  // Delete stored files — url is a GCS object path for new uploads, Vercel Blob URL for legacy
  if (attachmentUrls.length > 0) {
    await Promise.allSettled(
      attachmentUrls.map((url) =>
        url.startsWith("https://") ? del(url) : deleteFromGCS(url)
      )
    );
  }

  // Remove FK relations that don't have onDelete: Cascade on the User side
  await prisma.$transaction([
    prisma.taskActivity.deleteMany({ where: { userId: session.userId } }),
    prisma.taskDescriptionVersion.deleteMany({ where: { userId: session.userId } }),
    prisma.bugReport.deleteMany({ where: { userId: session.userId } }),
    prisma.attachment.deleteMany({ where: { uploadedBy: session.userId } }),
    prisma.task.updateMany({ where: { assigneeId: session.userId }, data: { assigneeId: null } }),
  ]);

  // Delete the user — cascades Notification, PushSubscription, EmailVerification,
  // BoardMember, BoardInvite, TaskAssignee, ClassMember, PasswordResetToken
  await prisma.user.delete({ where: { id: session.userId } });

  await destroySession();
  return NextResponse.json({ ok: true });
}
