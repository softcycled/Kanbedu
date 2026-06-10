import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getClassRole } from "@/lib/auth";
import { cloneClassSchema, parseBody } from "@/lib/validations";
import { createGroupBoard, coercePreset } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";

// POST: clone a class for a new semester. Copies the preset and the group
// structure (each group gets a fresh, empty board seeded from the preset).
// Students are NOT copied unless copyRoster is set; when set, each student is
// placed into the corresponding new group (preserving teams across terms).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "class_clone", 5, 60);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can clone a class." }, { status: 403 });
    }

    const raw = await req.json().catch(() => ({}));
    const result = parseBody(cloneClassSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    const source = await prisma.class.findUnique({
      where: { id },
      include: {
        preset: true,
        groups: { orderBy: { order: "asc" } },
        members: true,
      },
    });
    if (!source) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const presetData = coercePreset(source.preset?.columns, source.preset?.tasks);
    const newName = result.data.name?.trim() || source.name;
    const newTerm = result.data.term?.trim() || null;

    const newClass = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: { name: newName, term: newTerm, ownerId: session.userId },
      });
      await tx.classMember.create({
        data: { userId: session.userId, classId: cls.id, role: "educator" },
      });
      await tx.classPreset.create({
        data: {
          classId: cls.id,
          columns: presetData.columns as unknown as Prisma.InputJsonValue,
          tasks: presetData.tasks as unknown as Prisma.InputJsonValue,
        },
      });

      // Recreate groups, mapping old group id -> new group (board) for roster copy.
      const groupMap = new Map<string, { groupId: string; boardId: string }>();
      for (const g of source.groups) {
        const boardId = await createGroupBoard(tx, {
          name: g.name,
          educatorId: session.userId,
          preset: presetData,
        });
        const created = await tx.group.create({
          data: { classId: cls.id, name: g.name, order: g.order, boardId },
        });
        groupMap.set(g.id, { groupId: created.id, boardId });
      }

      if (result.data.copyRoster) {
        await Promise.all(
          source.members
            .filter((m) => m.userId !== session.userId)
            .map(async (m) => {
              if (m.role === "educator") {
                return tx.classMember.create({ data: { userId: m.userId, classId: cls.id, role: "ta" } });
              }
              const mapped = m.groupId ? groupMap.get(m.groupId) : undefined;
              await tx.classMember.create({
                data: { userId: m.userId, classId: cls.id, role: m.role, groupId: mapped?.groupId ?? null },
              });
              if (mapped) {
                await tx.boardMember.upsert({
                  where: { userId_boardId: { userId: m.userId, boardId: mapped.boardId } },
                  update: {},
                  create: { userId: m.userId, boardId: mapped.boardId, role: "member" },
                });
              }
            })
        );
      }

      return cls;
    });

    return NextResponse.json(
      { id: newClass.id, name: newClass.name, term: newClass.term },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to clone class:", error);
    return NextResponse.json({ error: "Failed to clone class." }, { status: 500 });
  }
}
