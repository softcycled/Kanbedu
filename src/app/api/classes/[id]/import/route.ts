import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getClassRole, isClassArchived } from "@/lib/auth";
import { parseCSV } from "@/lib/csvParser";
import { createGroupBoard, coercePreset } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";

// POST: import a CSV roster into a class.
// Accepts multipart/form-data with a "file" field (.csv).
// Required columns: name, email. Optional: group.
//
// For each row:
//   - Upserts a ClassRosterEntry (email-keyed per class).
//   - If a user account with that email exists: upserts ClassMember with
//     displayName set from CSV and optionally assigns to the named group.
//
// If a "group" column is present, pre-creates any missing groups (with boards)
// and assigns matched students to their group.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "class_import", 5, 60);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can import rosters." }, { status: 403 });
    }
    if (await isClassArchived(id)) {
      return NextResponse.json({ error: "This class is archived." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      return NextResponse.json({ error: "CSV is empty or has no data rows." }, { status: 400 });
    }

    const sample = rows[0];
    if (!("email" in sample)) {
      return NextResponse.json({ error: 'CSV must have an "email" column.' }, { status: 400 });
    }
    if (!("name" in sample)) {
      return NextResponse.json({ error: 'CSV must have a "name" column.' }, { status: 400 });
    }

    const hasGroups = "group" in sample;

    // Normalize rows and drop those missing required fields
    const validRows = rows
      .map((r) => ({
        email: (r.email ?? "").toLowerCase().trim(),
        name: (r.name ?? "").trim(),
        groupName: hasGroups ? (r.group ?? "").trim() || null : null,
      }))
      .filter((r) => r.email && r.name);

    if (!validRows.length) {
      return NextResponse.json({ error: "No valid rows found (every row is missing name or email)." }, { status: 400 });
    }

    // Batch-look up existing accounts by email
    const emails = validRows.map((r) => r.email);
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const userByEmail = new Map(
      existingUsers.map((u) => [u.email?.toLowerCase().trim() ?? "", u.id])
    );

    // Pre-create missing groups if CSV has a group column
    const groupIdByName = new Map<string, string>(); // normalized name → groupId
    let groupsCreated = 0;

    if (hasGroups) {
      const groupNames = [
        ...new Set(validRows.map((r) => r.groupName).filter(Boolean) as string[]),
      ];

      const existingGroups = await prisma.group.findMany({
        where: { classId: id },
        select: { id: true, name: true },
      });
      for (const g of existingGroups) {
        groupIdByName.set(g.name.toLowerCase(), g.id);
      }

      if (groupNames.length > 0) {
        const preset = await prisma.classPreset.findUnique({ where: { classId: id } });
        const presetData = coercePreset(preset?.columns, preset?.tasks);
        let order = existingGroups.length;

        for (const gName of groupNames) {
          if (groupIdByName.has(gName.toLowerCase())) continue;
          const group = await prisma.$transaction(async (tx) => {
            const boardId = await createGroupBoard(tx, {
              name: gName,
              educatorId: session.userId,
              preset: presetData,
            });
            return tx.group.create({
              data: { classId: id, name: gName, order: order++, boardId },
            });
          });
          groupIdByName.set(gName.toLowerCase(), group.id);
          groupsCreated++;
        }
      }
    }

    // Process each row
    let matched = 0;
    let unmatched = 0;

    for (const row of validRows) {
      const userId = userByEmail.get(row.email);
      const groupId = row.groupName ? (groupIdByName.get(row.groupName.toLowerCase()) ?? null) : null;

      // Upsert the roster entry only — never auto-enroll existing accounts.
      // claimedBy is set exclusively by the student via the join-code flow.
      await prisma.classRosterEntry.upsert({
        where: { classId_email: { classId: id, email: row.email } },
        create: { classId: id, email: row.email, name: row.name, groupName: row.groupName },
        update: { name: row.name, groupName: row.groupName },
      });

      if (userId) {
        matched++;
      } else {
        unmatched++;
      }
    }

    return NextResponse.json({ ok: true, total: validRows.length, matched, unmatched, groupsCreated });
  } catch (error) {
    console.error("Failed to import roster:", error);
    return NextResponse.json({ error: "Failed to import roster." }, { status: 500 });
  }
}
