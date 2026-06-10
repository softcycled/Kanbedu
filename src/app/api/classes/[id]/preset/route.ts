import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getClassRole, isClassArchived } from "@/lib/auth";
import { savePresetSchema, parseBody } from "@/lib/validations";
import { coercePreset } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";

// GET: read the class preset (starting columns + seed tasks). Educator/TA only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can view the preset." }, { status: 403 });
    }

    const preset = await prisma.classPreset.findUnique({ where: { classId: id } });
    return NextResponse.json(coercePreset(preset?.columns, preset?.tasks));
  } catch (error) {
    console.error("Failed to load preset:", error);
    return NextResponse.json({ error: "Failed to load preset." }, { status: 500 });
  }
}

// PUT: save the preset. Affects future group boards only (existing boards are
// independent real data and are never retroactively mutated). Educator/TA only.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can edit the preset." }, { status: 403 });
    }
    if (await isClassArchived(id)) {
      return NextResponse.json({ error: "This class is archived. Unarchive it to make changes." }, { status: 403 });
    }

    const raw = await req.json();
    const result = parseBody(savePresetSchema, raw);
    if (!result.data) return NextResponse.json({ error: result.error }, { status: 400 });

    // Guard: every task must reference a real column index.
    const columnCount = result.data.columns.length;
    if (result.data.tasks.some((t) => t.columnIndex >= columnCount)) {
      return NextResponse.json({ error: "A seed task references a column that does not exist." }, { status: 400 });
    }

    const columns = result.data.columns.map((c) => ({ label: c.label, isDone: c.isDone }));
    const tasks = result.data.tasks.map((t) => ({
      title: t.title,
      description: t.description,
      columnIndex: t.columnIndex,
      priority: t.priority,
    }));

    const jsonColumns = columns as unknown as Prisma.InputJsonValue;
    const jsonTasks = tasks as unknown as Prisma.InputJsonValue;
    await prisma.classPreset.upsert({
      where: { classId: id },
      update: { columns: jsonColumns, tasks: jsonTasks },
      create: { classId: id, columns: jsonColumns, tasks: jsonTasks },
    });

    return NextResponse.json({ columns, tasks });
  } catch (error) {
    console.error("Failed to save preset:", error);
    return NextResponse.json({ error: "Failed to save preset." }, { status: 500 });
  }
}
