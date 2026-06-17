import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole, isClassArchived } from "@/lib/auth";
import { parseCSV } from "@/lib/csvParser";
import { createGroupBoard, coercePreset } from "@/lib/classBoards";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendClassInviteEmail } from "@/lib/email";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const MAX_ROSTER_ROWS = 100;
// Safety cap: never send more than this many invite emails in a single import.
// Brevo free tier is 300/day — one large class import could exhaust the daily quota.
const MAX_INVITE_EMAILS = 50;

// POST: import a CSV roster into a class.
// Accepts multipart/form-data with a "file" field (.csv).
// Required columns: name, email. Optional: group.
//
// For each row:
//   - Upserts a ClassRosterEntry (email-keyed per class), storing the name and
//     optional group name. Existing accounts are matched by email for the
//     summary counts only — students are never auto-enrolled here. Enrollment
//     (and group assignment) happens when the student joins via the join-code
//     flow, which reads the roster entry and sets claimedBy.
//
// If a "group" column is present, pre-creates any missing groups (with boards)
// so the named group already exists when a matched student later joins.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
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

    const cls = await prisma.class.findUnique({ where: { id }, select: { name: true, joinCode: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

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
    if (validRows.length > MAX_ROSTER_ROWS) {
      return NextResponse.json({ error: `CSV exceeds the ${MAX_ROSTER_ROWS}-student limit. Split it into smaller files.` }, { status: 400 });
    }

    const emails = validRows.map((r) => r.email);

    // Pre-check which emails already have a roster entry so we only invite new ones
    const existingRosterEntries = await prisma.classRosterEntry.findMany({
      where: { classId: id, email: { in: emails } },
      select: { email: true },
    });
    const existingRosterEmails = new Set(existingRosterEntries.map((e) => e.email));

    // Batch-look up existing accounts by email
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
    const newlyAdded: { email: string; name: string }[] = [];

    for (const row of validRows) {
      const userId = userByEmail.get(row.email);

      // Upsert the roster entry only — never auto-enroll existing accounts.
      // claimedBy is set exclusively by the student via the join-code flow.
      await prisma.classRosterEntry.upsert({
        where: { classId_email: { classId: id, email: row.email } },
        create: { classId: id, email: row.email, name: row.name, groupName: row.groupName },
        update: { name: row.name, groupName: row.groupName },
      });

      if (!existingRosterEmails.has(row.email)) {
        newlyAdded.push({ email: row.email, name: row.name });
      }

      if (userId) {
        matched++;
      } else {
        unmatched++;
      }
    }

    // Send invite emails to newly added students.
    // Capped at MAX_INVITE_EMAILS per import to avoid exhausting Brevo's 300/day free-tier limit.
    // Uses Promise.allSettled (not fire-and-forget) so we can surface failures in the response.
    let inviteSent = 0;
    let inviteFailed = 0;
    let inviteCapped = 0;

    if (newlyAdded.length > 0) {
      const toInvite = newlyAdded.slice(0, MAX_INVITE_EMAILS);
      inviteCapped = newlyAdded.length - toInvite.length;
      const joinUrl = `${BASE_URL}/class/join/${cls.joinCode}`;
      const results = await Promise.allSettled(
        toInvite.map(({ email, name }) => sendClassInviteEmail(email, name, cls.name, joinUrl))
      );
      for (const r of results) {
        if (r.status === "fulfilled") inviteSent++;
        else { inviteFailed++; console.error("Invite email failed:", r.reason); }
      }
    }

    return NextResponse.json({
      ok: true,
      total: validRows.length,
      matched,
      unmatched,
      groupsCreated,
      invited: inviteSent,
      inviteFailed,
      inviteCapped,
    });
  } catch (error) {
    console.error("Failed to import roster:", error);
    return NextResponse.json({ error: "Failed to import roster." }, { status: 500 });
  }
}
