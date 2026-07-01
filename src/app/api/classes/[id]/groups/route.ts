import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole, isClassArchived } from "@/lib/auth";
import { logAuthzDenied } from "@/lib/securityLog";
import { createGroupSchema, updateGroupSchema, parseBody } from "@/lib/validations";
import { createGroupBoard, coercePreset } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";

async function requireEducator(userId: string, classId: string) {
  const role = await getClassRole(userId, classId);
  return role === "educator" || role === "ta";
}

async function requireOwnerEducator(userId: string, classId: string) {
  const role = await getClassRole(userId, classId);
  return role === "educator";
}

const archivedError = () =>
  NextResponse.json({ error: "This class is archived. Unarchive it to make changes." }, { status: 403 });

// POST: create a group. Also creates its board seeded from the class preset.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    if (!(await requireEducator(session.userId, id))) {
      logAuthzDenied(req, "/api/classes/[id]/groups", session.userId, "POST educator-only");
      return NextResponse.json({ error: "Only educators can manage groups." }, { status: 403 });
    }
    if (await isClassArchived(id)) return archivedError();

    const raw = await req.json();
    const result = parseBody(createGroupSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    const [preset, groupCount] = await Promise.all([
      prisma.classPreset.findUnique({ where: { classId: id } }),
      prisma.group.count({ where: { classId: id } }),
    ]);
    const presetData = coercePreset(preset?.columns, preset?.tasks);

    const group = await prisma.$transaction(async (tx) => {
      const boardId = await createGroupBoard(tx, {
        name: result.data.name,
        educatorId: session.userId,
        preset: presetData,
      });
      return tx.group.create({
        data: { classId: id, name: result.data.name, order: groupCount, boardId },
      });
    });

    return NextResponse.json(
      { id: group.id, name: group.name, order: group.order, boardId: group.boardId, memberCount: 0, taskCount: 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create group:", error);
    return NextResponse.json({ error: "Failed to create group." }, { status: 500 });
  }
}

// PATCH: rename a single group ({ groupId, name }) or reorder ({ order: string[] }).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    if (!(await requireEducator(session.userId, id))) {
      logAuthzDenied(req, "/api/classes/[id]/groups", session.userId, "PATCH educator-only");
      return NextResponse.json({ error: "Only educators can manage groups." }, { status: 403 });
    }
    if (await isClassArchived(id)) return archivedError();

    const raw = await req.json();

    // Reorder branch: { order: ["groupId1", "groupId2", ...] }
    if (Array.isArray(raw?.order)) {
      const ids: string[] = raw.order;
      const owned = await prisma.group.findMany({ where: { classId: id }, select: { id: true } });
      const ownedIds = new Set(owned.map((g) => g.id));
      if (ids.some((gid) => !ownedIds.has(gid))) {
        return NextResponse.json({ error: "Invalid group list." }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < ids.length; index++) {
          await tx.group.update({ where: { id: ids[index] }, data: { order: index } });
        }
      });
      return NextResponse.json({ success: true });
    }

    // Single-group update branch.
    const groupId = typeof raw?.groupId === "string" ? raw.groupId : "";
    if (!groupId) return NextResponse.json({ error: "groupId is required." }, { status: 400 });
    const result = parseBody(updateGroupSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    const group = await prisma.group.findFirst({ where: { id: groupId, classId: id } });
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.group.update({
        where: { id: groupId },
        data: {
          ...(result.data.name !== undefined ? { name: result.data.name } : {}),
          ...(result.data.order !== undefined ? { order: result.data.order } : {}),
        },
      });
      if (result.data.name !== undefined) {
        await tx.board.update({ where: { id: group.boardId }, data: { name: result.data.name } });
      }
      return g;
    });

    return NextResponse.json({ id: updated.id, name: updated.name, order: updated.order, boardId: updated.boardId });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }
    console.error("Failed to update group:", error);
    return NextResponse.json({ error: "Failed to update group." }, { status: 500 });
  }
}

// DELETE ({ groupId }): remove a group. Deleting its board cascades the group,
// its tasks/columns/members; students in the group fall back to the lobby.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl3 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl3.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    if (!(await requireOwnerEducator(session.userId, id))) {
      logAuthzDenied(req, "/api/classes/[id]/groups", session.userId, "DELETE owner-only");
      return NextResponse.json({ error: "Only educators can delete groups." }, { status: 403 });
    }
    if (await isClassArchived(id)) return archivedError();

    const raw = await req.json().catch(() => ({}));
    const groupId = typeof raw?.groupId === "string" ? raw.groupId : "";
    if (!groupId) return NextResponse.json({ error: "groupId is required." }, { status: 400 });

    const group = await prisma.group.findFirst({ where: { id: groupId, classId: id } });
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    // Deleting the board cascades the Group row (Group.board onDelete: Cascade)
    // and sets ClassMember.groupId to null for affected students.
    await prisma.board.delete({ where: { id: group.boardId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete group:", error);
    return NextResponse.json({ error: "Failed to delete group." }, { status: 500 });
  }
}
