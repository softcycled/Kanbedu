import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { createClassSchema, parseBody } from "@/lib/validations";
import { DEFAULT_PRESET } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";

// GET: list every class the current user belongs to (any role).
export async function GET() {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const memberships = await prisma.classMember.findMany({
      where: { userId: session.userId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            term: true,
            archived: true,
            createdAt: true,
            _count: { select: { groups: true, members: true } },
          },
        },
        // The caller's OWN group (their membership's group) and its board ref.
        // This only ever reveals the user's own group secret — never another
        // group's — so students can render their board inside the app shell.
        group: {
          select: { id: true, name: true, boardId: true, board: { select: { realtimeSecret: true } } },
        },
      },
      orderBy: [{ order: "asc" }, { class: { createdAt: "asc" } }],
    });

    const classes = memberships.map((m) => ({
      id: m.class.id,
      name: m.class.name,
      term: m.class.term,
      archived: m.class.archived,
      createdAt: m.class.createdAt.toISOString(),
      role: m.role,
      myGroupId: m.groupId,
      groupName: m.group?.name ?? null,
      boardId: m.group?.boardId ?? null,
      realtimeSecret: m.group?.board?.realtimeSecret ?? null,
      groupCount: m.class._count.groups,
      memberCount: m.class._count.members,
    }));

    return NextResponse.json(classes);
  } catch (error) {
    console.error("Failed to list classes:", error);
    return NextResponse.json({ error: "Failed to list classes." }, { status: 500 });
  }
}

// POST: create a new class. The creator becomes its educator, a default preset
// is attached, and a persistent joinCode is generated.
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const limit = await checkRateLimit(session.userId, "class-create", 20, 60);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many classes created. Try again later." }, { status: 429 });
    }

    const raw = await request.json();
    const result = parseBody(createClassSchema, raw);
    if (!result.data) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const created = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: { name: data.name, term: data.term ?? null, ownerId: session.userId },
      });
      await tx.classMember.create({
        data: { userId: session.userId, classId: cls.id, role: "educator" },
      });
      await tx.classPreset.create({
        data: {
          classId: cls.id,
          columns: DEFAULT_PRESET.columns as unknown as Prisma.InputJsonValue,
          tasks: DEFAULT_PRESET.tasks as unknown as Prisma.InputJsonValue,
        },
      });
      return cls;
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        term: created.term,
        archived: created.archived,
        role: "educator",
        joinCode: created.joinCode,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create class:", error);
    return NextResponse.json({ error: "Failed to create class." }, { status: 500 });
  }
}

// PUT: reorder the caller's class memberships by storing an explicit order index.
export async function PUT(request: NextRequest) {
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "Invalid ids." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < ids.length; index++) {
        await tx.classMember.updateMany({
          where: { userId: session.userId, classId: ids[index] },
          data: { order: index },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reorder classes:", error);
    return NextResponse.json({ error: "Failed to reorder classes." }, { status: 500 });
  }
}
