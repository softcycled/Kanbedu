import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getVerifiedSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToGCS, getSignedUrl, deleteFromGCS } from "@/lib/gcs";
import { logAuthzDenied } from "@/lib/securityLog";

class AttachmentLimitError extends Error {}
class BoardStorageLimitError extends Error {}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PER_TASK = 10;
const MAX_BOARD_BYTES = 100 * 1024 * 1024; // 100MB total per board

// Allowlist of accepted upload types mapped to their valid extensions. Anything
// not listed is rejected. SVG and HTML are intentionally excluded: served from
// the blob domain they can execute script (stored XSS). The declared MIME type
// and the filename extension must agree, so a disguised file (e.g. .html renamed
// to .png, or text/html sent with a .png name) is rejected.
const ALLOWED_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
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
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!task.columnRel.board?.members?.length) {
    logAuthzDenied(_req, "/api/tasks/[id]/attachments", session.userId, "GET cross-tenant");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
  });

  // url field may be a GCS object path (new uploads) or a legacy Vercel Blob URL.
  // Generate a signed URL for GCS paths; pass Blob URLs through unchanged.
  const withUrls = await Promise.all(
    attachments.map(async (a) => ({
      ...a,
      url: a.url.startsWith("https://") ? a.url : await getSignedUrl(a.url),
    }))
  );

  return NextResponse.json(withUrls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getVerifiedSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      columnRel: {
        select: {
          boardId: true,
          board: {
            select: {
              members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!task.columnRel.board?.members?.length) {
    logAuthzDenied(req, "/api/tasks/[id]/attachments", session.userId, "POST cross-tenant");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const count = await prisma.attachment.count({ where: { taskId: id } });
  if (count >= MAX_PER_TASK) {
    return NextResponse.json({ error: "Attachment limit reached (max 10 per task)." }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File is empty." }, { status: 400 });

  // Type allowlist: the declared MIME type must be allowed and the filename
  // extension must match it. Rejects executable/markup uploads (SVG, HTML) and
  // type/extension mismatches.
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  const allowedExts = ALLOWED_TYPES[file.type];
  if (!allowedExts || !allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: images (JPG, PNG, GIF, WebP), PDF, TXT, CSV, and Office documents." },
      { status: 400 }
    );
  }

  const boardSizeResult = await prisma.attachment.aggregate({
    where: { task: { columnRel: { boardId: task.columnRel.boardId } } },
    _sum: { size: true },
  });
  if ((boardSizeResult._sum.size ?? 0) + file.size > MAX_BOARD_BYTES) {
    return NextResponse.json(
      { error: "Board storage full (100 MB limit). Delete some attachments from this board to free up space." },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `attachments/${id}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToGCS(objectPath, buffer, file.type);

  const signedUrl = await getSignedUrl(objectPath);
  const boardId = task.columnRel.boardId;

  // The checks above are a fast-fail for the common case, but the upload to
  // GCS takes long enough that two concurrent uploads can both pass them and
  // both still be under the cap when they get here. Re-check inside a
  // serializable transaction right before the insert so the count/size cap
  // can't be overshot; clean up the now-orphaned GCS object if this upload
  // loses the race.
  const runInsert = () =>
    prisma.$transaction(
      async (tx) => {
        const recount = await tx.attachment.count({ where: { taskId: id } });
        if (recount >= MAX_PER_TASK) throw new AttachmentLimitError();

        const boardSize = await tx.attachment.aggregate({
          where: { task: { columnRel: { boardId } } },
          _sum: { size: true },
        });
        if ((boardSize._sum.size ?? 0) + file.size > MAX_BOARD_BYTES) throw new BoardStorageLimitError();

        return tx.attachment.create({
          data: {
            taskId: id,
            url: objectPath,
            filename: file.name,
            size: file.size,
            contentType: file.type,
            uploadedBy: session.userId,
          },
          select: { id: true, url: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  let attachment;
  try {
    try {
      attachment = await runInsert();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        attachment = await runInsert();
      } else {
        throw err;
      }
    }
  } catch (error) {
    if (error instanceof AttachmentLimitError) {
      await deleteFromGCS(objectPath).catch(() => {});
      return NextResponse.json({ error: "Attachment limit reached (max 10 per task)." }, { status: 400 });
    }
    if (error instanceof BoardStorageLimitError) {
      await deleteFromGCS(objectPath).catch(() => {});
      return NextResponse.json(
        { error: "Board storage full (100 MB limit). Delete some attachments from this board to free up space." },
        { status: 400 }
      );
    }
    await deleteFromGCS(objectPath).catch(() => {});
    throw error;
  }

  return NextResponse.json({ ...attachment, url: signedUrl }, { status: 201 });
}
