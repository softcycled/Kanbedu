import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole } from "@/lib/auth";
import { updateClassSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

// GET: role-aware class detail.
// Educators/TAs receive the full roster, groups and joinCode.
// Students receive only their own group reference (no cross-group data).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const role = await getClassRole(session.userId, id);
    if (!role) return NextResponse.json({ error: "Not a member of this class." }, { status: 403 });

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        groups: {
          orderBy: { order: "asc" },
          include: {
            _count: { select: { members: true } },
            board: { select: { columns: { select: { _count: { select: { tasks: true } } } } } },
          },
        },
        members: {
          include: { user: { select: { id: true, name: true, handle: true, color: true, email: true } } },
        },
      },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const me = cls.members.find((m) => m.userId === session.userId);
    const isEducator = role === "educator" || role === "ta";

    const base = {
      id: cls.id,
      name: cls.name,
      term: cls.term,
      archived: cls.archived,
      role,
      myGroupId: me?.groupId ?? null,
    };

    if (!isEducator) {
      // Student view: just enough to render their group board or the lobby.
      const myGroup = cls.groups.find((g) => g.id === me?.groupId);
      // Include the student's own group members so the board can show a member list.
      // Include the student's group peers + all educators/TAs (they oversee every group).
      const groupMembers = myGroup
        ? cls.members
            .filter((m) => m.groupId === myGroup.id || m.role === "educator" || m.role === "ta")
            .map((m) => ({ id: m.userId, name: m.user.name, handle: m.user.handle, color: m.user.color, role: m.role }))
        : [];
      return NextResponse.json({
        ...base,
        myBoardId: myGroup?.boardId ?? null,
        myGroupName: myGroup?.name ?? null,
        groups: [],
        members: groupMembers,
      });
    }

    // Educator view: full structure.
    return NextResponse.json({
      ...base,
      joinCode: cls.joinCode,
      groups: cls.groups.map((g) => ({
        id: g.id,
        name: g.name,
        order: g.order,
        boardId: g.boardId,
        memberCount: g._count.members,
        taskCount: g.board.columns.reduce((s, c) => s + c._count.tasks, 0),
      })),
      members: cls.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        groupId: m.groupId,
        displayName: m.displayName ?? null,
        name: m.user.name,
        handle: m.user.handle,
        color: m.user.color,
        email: m.user.email,
      })),
    });
  } catch (error) {
    console.error("Failed to load class:", error);
    return NextResponse.json({ error: "Failed to load class." }, { status: 500 });
  }
}

// PATCH: rename / set term / archive. Educator or TA only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can edit a class." }, { status: 403 });
    }

    const raw = await req.json();
    const result = parseBody(updateClassSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    if (result.data.archived !== undefined && role !== "educator") {
      return NextResponse.json({ error: "Only the class owner can archive or unarchive a class." }, { status: 403 });
    }

    // Archived classes are read-only: detail edits (name/term) are rejected
    // unless the same request also unarchives. Toggling archived is always OK.
    const editingDetails = result.data.name !== undefined || result.data.term !== undefined;
    if (editingDetails) {
      const current = await prisma.class.findUnique({ where: { id }, select: { archived: true } });
      if (!current) return NextResponse.json({ error: "Class not found." }, { status: 404 });
      const willBeArchived = result.data.archived ?? current.archived;
      if (willBeArchived) {
        return NextResponse.json({ error: "This class is archived. Unarchive it to edit details." }, { status: 403 });
      }
    }

    const updated = await prisma.class.update({
      where: { id },
      data: {
        ...(result.data.name !== undefined ? { name: result.data.name } : {}),
        ...(result.data.term !== undefined ? { term: result.data.term } : {}),
        ...(result.data.archived !== undefined ? { archived: result.data.archived } : {}),
      },
      select: { id: true, name: true, term: true, archived: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }
    console.error("Failed to update class:", error);
    return NextResponse.json({ error: "Failed to update class." }, { status: 500 });
  }
}

// DELETE: permanently delete a class. Owner (educator) only.
// Group boards are not cascaded from Class, so they are removed explicitly;
// deleting each board cascades its columns/tasks/members and its Group row.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl2 = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl2.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const cls = await prisma.class.findUnique({
      where: { id },
      select: { ownerId: true, groups: { select: { boardId: true } } },
    });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (cls.ownerId !== session.userId) {
      return NextResponse.json({ error: "Only the class owner can delete it." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      const boardIds = cls.groups.map((g) => g.boardId);
      if (boardIds.length > 0) {
        // Column and Task have no onDelete cascade to Board/Column in the schema,
        // so they must be deleted explicitly before the boards can be removed.
        const columns = await tx.column.findMany({ where: { boardId: { in: boardIds } }, select: { id: true } });
        const columnIds = columns.map((c) => c.id);
        if (columnIds.length > 0) {
          // Cascades comments, activities, column histories, description versions via onDelete: Cascade on those models.
          await tx.task.deleteMany({ where: { column: { in: columnIds } } });
          await tx.column.deleteMany({ where: { id: { in: columnIds } } });
        }
        // Cascades BoardMembers, BoardInvites, Tags, and Group rows.
        await tx.board.deleteMany({ where: { id: { in: boardIds } } });
      }
      // Must delete explicitly — not covered by Class cascade in all Postgres versions.
      await tx.classRosterEntry.deleteMany({ where: { classId: id } });
      // Cascades ClassMember and ClassPreset.
      await tx.class.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete class:", error);
    return NextResponse.json({ error: "Failed to delete class." }, { status: 500 });
  }
}
