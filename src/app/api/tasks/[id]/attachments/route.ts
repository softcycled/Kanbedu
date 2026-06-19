import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { logAuthzDenied } from "@/lib/securityLog";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PER_TASK = 20;

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

  return NextResponse.json(attachments);
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
    return NextResponse.json({ error: "Attachment limit reached (max 20 per task)." }, { status: 400 });
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

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobPath = `attachments/${id}/${Date.now()}-${safeName}`;

  const blob = await put(blobPath, file, { access: "public" });

  const attachment = await prisma.attachment.create({
    data: {
      taskId: id,
      url: blob.url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      uploadedBy: session.userId,
    },
    select: { id: true, url: true, filename: true, size: true, contentType: true, uploadedBy: true, createdAt: true },
  });

  return NextResponse.json(attachment, { status: 201 });
}
