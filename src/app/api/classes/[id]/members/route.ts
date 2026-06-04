import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getClassRole } from "@/lib/auth";
import { updateMemberSchema, parseBody } from "@/lib/validations";

// PATCH: assign/move a student to a group, return them to the lobby, change
// their role, or remove them from the class. Educator/TA only.
//
// Keeps BoardMember rows in sync with group assignment so a student can only
// ever access the board of the group they currently belong to.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can manage members." }, { status: 403 });
    }

    const raw = await req.json();
    const result = parseBody(updateMemberSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });
    const { userId, groupId, role: newRole, remove } = result.data;

    const cls = await prisma.class.findUnique({ where: { id }, select: { ownerId: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const member = await prisma.classMember.findUnique({
      where: { userId_classId: { userId, classId: id } },
      include: { group: { select: { boardId: true } } },
    });
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

    // The class owner cannot be removed, re-grouped, or demoted.
    if (userId === cls.ownerId && (remove || groupId !== undefined || newRole !== undefined)) {
      return NextResponse.json({ error: "The class owner cannot be modified." }, { status: 400 });
    }

    const oldBoardId = member.group?.boardId ?? null;

    // --- Remove from the class entirely ---
    if (remove) {
      await prisma.$transaction(async (tx) => {
        if (oldBoardId) {
          await tx.boardMember.deleteMany({ where: { userId, boardId: oldBoardId } });
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
        // Remove from the previous group's board.
        if (oldBoardId && oldBoardId !== newBoardId) {
          await tx.boardMember.deleteMany({ where: { userId, boardId: oldBoardId } });
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
    });

    return NextResponse.json({ success: true, userId, groupId: groupId ?? null });
  } catch (error) {
    console.error("Failed to update member:", error);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}
