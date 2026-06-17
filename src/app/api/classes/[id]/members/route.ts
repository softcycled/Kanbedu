import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole, isClassArchived } from "@/lib/auth";
import { updateMemberSchema, assignMembersSchema, parseBody } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

// Remove a user from all task assignments on a board: delete their junction
// rows, then re-mirror assigneeId to the next remaining assignee (or null) so
// the legacy single-assignee column stays consistent.
async function unassignUserFromBoardTasks(
  tx: Prisma.TransactionClient,
  userId: string,
  boardId: string
) {
  const cols = await tx.column.findMany({ where: { boardId }, select: { id: true } });
  if (cols.length === 0) return;
  const colIds = cols.map((c) => c.id);
  await tx.taskAssignee.deleteMany({
    where: { userId, task: { column: { in: colIds } } },
  });
  await tx.$executeRaw`
    UPDATE "Task" t SET "assigneeId" = (
      SELECT ta."userId" FROM "TaskAssignee" ta
      WHERE ta."taskId" = t."id" ORDER BY ta."assignedAt" ASC LIMIT 1
    )
    WHERE t."column" IN (${Prisma.join(colIds)}) AND t."assigneeId" = ${userId}`;
}

// PATCH: assign/move a student to a group, return them to the lobby, change
// their role, remove them from the class, or assign many students at once
// (batch). Educator/TA only.
//
// Keeps BoardMember rows in sync with group assignment so a student can only
// ever access the board of the group they currently belong to.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can manage members." }, { status: 403 });
    }

    // Archived classes are read-only management surfaces.
    if (await isClassArchived(id)) {
      return NextResponse.json({ error: "This class is archived. Unarchive it to make changes." }, { status: 403 });
    }

    const cls = await prisma.class.findUnique({ where: { id }, select: { ownerId: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const raw = await req.json();

    // --- Batch assignment branch: { assignments: [{ userId, groupId }] } ---
    if (Array.isArray(raw?.assignments)) {
      const parsed = parseBody(assignMembersSchema, raw);
      if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

      const [members, groups] = await Promise.all([
        prisma.classMember.findMany({
          where: { classId: id },
          include: { group: { select: { boardId: true } } },
        }),
        prisma.group.findMany({ where: { classId: id }, select: { id: true, boardId: true } }),
      ]);
      const memberByUser = new Map(members.map((m) => [m.userId, m]));
      const groupBoard = new Map(groups.map((g) => [g.id, g.boardId]));

      // Validate every assignment before touching anything.
      for (const a of parsed.data.assignments) {
        if (!memberByUser.has(a.userId)) {
          return NextResponse.json({ error: "A selected student is not in this class." }, { status: 400 });
        }
        if (a.userId === cls.ownerId) {
          return NextResponse.json({ error: "The class owner cannot be reassigned." }, { status: 400 });
        }
        if (a.groupId !== null && !groupBoard.has(a.groupId)) {
          return NextResponse.json({ error: "A target group was not found." }, { status: 400 });
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const a of parsed.data!.assignments) {
          const member = memberByUser.get(a.userId)!;
          const oldBoardId = member.group?.boardId ?? null;
          const newBoardId = a.groupId === null ? null : groupBoard.get(a.groupId)!;
          // No-op if nothing actually changes.
          if ((member.groupId ?? null) === (a.groupId ?? null)) continue;

          if (oldBoardId && oldBoardId !== newBoardId) {
            await tx.boardMember.deleteMany({ where: { userId: a.userId, boardId: oldBoardId } });
            // Unassign from tasks on the old board — treat as leaving the group.
            await unassignUserFromBoardTasks(tx, a.userId, oldBoardId);
          }
          if (newBoardId) {
            await tx.boardMember.upsert({
              where: { userId_boardId: { userId: a.userId, boardId: newBoardId } },
              update: {},
              create: { userId: a.userId, boardId: newBoardId, role: "member" },
            });
          }
          await tx.classMember.update({
            where: { userId_classId: { userId: a.userId, classId: id } },
            data: { groupId: a.groupId },
          });
        }
      });

      return NextResponse.json({ success: true, count: parsed.data.assignments.length });
    }

    // --- Single-member branch (assign / move / role / remove) ---
    const result = parseBody(updateMemberSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });
    const { userId, groupId, role: newRole, remove, displayName } = result.data;

    // TAs can assign students to groups or remove them, but only educators
    // can promote/demote members — otherwise a TA could grant TA privileges.
    if (newRole !== undefined && role !== "educator") {
      return NextResponse.json({ error: "Only educators can change member roles." }, { status: 403 });
    }

    const member = await prisma.classMember.findUnique({
      where: { userId_classId: { userId, classId: id } },
      include: { group: { select: { boardId: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    // The class owner cannot be removed, re-grouped, or demoted (displayName is allowed).
    if (userId === cls.ownerId && (remove || groupId !== undefined || newRole !== undefined)) {
      return NextResponse.json({ error: "The class owner cannot be modified." }, { status: 400 });
    }

    const oldBoardId = member.group?.boardId ?? null;

    // --- Remove from the class entirely ---
    if (remove) {
      await prisma.$transaction(async (tx) => {
        if (oldBoardId) {
          await tx.boardMember.deleteMany({ where: { userId, boardId: oldBoardId } });
          await unassignUserFromBoardTasks(tx, userId, oldBoardId);
        }
        await tx.classMember.delete({ where: { userId_classId: { userId, classId: id } } });
      });
      return NextResponse.json({ success: true, removed: true });
    }

    // --- Resolve a group change (assign / move / send to lobby) ---
    let newBoardId: string | null | undefined; // undefined = no group change
    if (groupId !== undefined) {
      if (groupId === null) {
        newBoardId = null; // back to lobby
      } else {
        const target = await prisma.group.findFirst({
          where: { id: groupId, classId: id },
          select: { boardId: true },
        });
        if (!target) return NextResponse.json({ error: "Target group not found." }, { status: 404 });
        newBoardId = target.boardId;
      }
    }

    await prisma.$transaction(async (tx) => {
      if (groupId !== undefined) {
        // Remove from the previous group's board and unassign their tasks.
        if (oldBoardId && oldBoardId !== newBoardId) {
          await tx.boardMember.deleteMany({ where: { userId, boardId: oldBoardId } });
          await unassignUserFromBoardTasks(tx, userId, oldBoardId);
        }
        // Add to the new group's board (idempotent).
        if (newBoardId) {
          await tx.boardMember.upsert({
            where: { userId_boardId: { userId, boardId: newBoardId } },
            update: {},
            create: { userId, boardId: newBoardId, role: "member" },
          });
        }
        await tx.classMember.update({
          where: { userId_classId: { userId, classId: id } },
          data: { groupId },
        });
      }

      if (newRole !== undefined) {
        await tx.classMember.update({
          where: { userId_classId: { userId, classId: id } },
          data: { role: newRole },
        });
      }

      if (displayName !== undefined) {
        await tx.classMember.update({
          where: { userId_classId: { userId, classId: id } },
          data: { displayName },
        });
      }
    });

    return NextResponse.json({ success: true, userId, groupId: groupId ?? null });
  } catch (error) {
    console.error("Failed to update member:", error);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}

// DELETE: the caller leaves the class themselves (students / TAs). The class
// owner cannot leave — they must delete the class (or transfer it later).
// Allowed even when archived: a member can always exit.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const cls = await prisma.class.findUnique({ where: { id }, select: { ownerId: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
    if (cls.ownerId === session.userId) {
      return NextResponse.json(
        { error: "The owner can't leave their own class. Delete it from Settings instead." },
        { status: 400 }
      );
    }

    const member = await prisma.classMember.findUnique({
      where: { userId_classId: { userId: session.userId, classId: id } },
      include: { group: { select: { boardId: true } } },
    });
    if (!member) return NextResponse.json({ error: "You are not a member of this class." }, { status: 404 });

    const boardId = member.group?.boardId ?? null;
    await prisma.$transaction(async (tx) => {
      if (boardId) {
        await tx.boardMember.deleteMany({ where: { userId: session.userId, boardId } });
      }
      await tx.classMember.delete({ where: { userId_classId: { userId: session.userId, classId: id } } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to leave class:", error);
    return NextResponse.json({ error: "Failed to leave class." }, { status: 500 });
  }
}
