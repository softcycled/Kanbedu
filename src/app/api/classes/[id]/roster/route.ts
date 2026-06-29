import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole, isClassArchived } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendClassInviteEmail } from "@/lib/email";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// POST { entryId }: resend the class invite email to a pending (unclaimed) roster entry.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can manage roster entries." }, { status: 403 });
    }
    if (await isClassArchived(id)) {
      return NextResponse.json({ error: "This class is archived. Unarchive it to make changes." }, { status: 403 });
    }

    const raw = await req.json().catch(() => ({}));
    const entryId = typeof raw?.entryId === "string" ? raw.entryId : null;
    if (!entryId) return NextResponse.json({ error: "entryId is required." }, { status: 400 });

    const entry = await prisma.classRosterEntry.findFirst({
      where: { id: entryId, classId: id, claimedBy: null },
    });
    if (!entry) return NextResponse.json({ error: "Roster entry not found or already claimed." }, { status: 404 });

    const cls = await prisma.class.findUnique({ where: { id }, select: { name: true, joinCode: true } });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const joinUrl = `${BASE_URL}/class/join/${cls.joinCode}`;
    await sendClassInviteEmail(entry.email, entry.name, cls.name, joinUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to resend invite:", error);
    return NextResponse.json({ error: "Failed to resend invite." }, { status: 500 });
  }
}

// DELETE { entryId }: remove a pending (unclaimed) roster entry.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const rl = await checkRateLimit(session.userId, "api_write", 300, 15);
    if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can manage roster entries." }, { status: 403 });
    }
    if (await isClassArchived(id)) {
      return NextResponse.json({ error: "This class is archived. Unarchive it to make changes." }, { status: 403 });
    }

    const raw = await req.json().catch(() => ({}));
    const entryId = typeof raw?.entryId === "string" ? raw.entryId : null;
    if (!entryId) return NextResponse.json({ error: "entryId is required." }, { status: 400 });

    const deleted = await prisma.classRosterEntry.deleteMany({
      where: { id: entryId, classId: id, claimedBy: null },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Roster entry not found or already claimed." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove roster entry:", error);
    return NextResponse.json({ error: "Failed to remove roster entry." }, { status: 500 });
  }
}
