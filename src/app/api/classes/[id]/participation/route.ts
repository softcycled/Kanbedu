import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole } from "@/lib/auth";
import { getClassNameOverrides } from "@/lib/classNames";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getVerifiedSession();
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const role = await getClassRole(session.userId, id);
    if (role !== "educator" && role !== "ta") {
      return NextResponse.json({ error: "Only educators can view participation." }, { status: 403 });
    }

    const [groups, nameOverrides, classMembers] = await Promise.all([
      prisma.group.findMany({
        where: { classId: id },
        orderBy: { order: "asc" },
        include: {
          board: {
            include: {
              members: {
                include: { user: { select: { id: true, name: true, handle: true, color: true, email: true } } },
              },
              columns: { select: { id: true } },
            },
          },
        },
      }),
      getClassNameOverrides(id),
      prisma.classMember.findMany({
        where: { classId: id },
        select: { userId: true, role: true },
      }),
    ]);

    const nonStudentIds = new Set(
      classMembers.filter((m) => m.role === "educator" || m.role === "ta").map((m) => m.userId)
    );

    // Map column id -> boardId, task id -> boardId
    const colToBoardId = new Map<string, string>();
    for (const g of groups) {
      for (const c of g.board.columns) {
        colToBoardId.set(c.id, g.boardId);
      }
    }

    const allColumnIds = [...colToBoardId.keys()];
    if (allColumnIds.length === 0) {
      return NextResponse.json({ groups: groups.map((g) => ({ groupId: g.id, name: g.name, boardId: g.boardId, members: [] })) });
    }

    const tasks = await prisma.task.findMany({
      where: { column: { in: allColumnIds } },
      select: { id: true, column: true },
    });

    const taskToBoardId = new Map<string, string>();
    for (const t of tasks) {
      const bId = colToBoardId.get(t.column);
      if (bId) taskToBoardId.set(t.id, bId);
    }

    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length === 0) {
      return NextResponse.json({
        groups: groups.map((g) => ({
          groupId: g.id,
          name: g.name,
          boardId: g.boardId,
          members: g.board.members.filter((m) => !nonStudentIds.has(m.user.id)).map((m) => ({
            userId: m.user.id,
            name: nameOverrides.get(m.user.id) || m.user.name || (m.user.handle ? `@${m.user.handle}` : "Unknown"),
            handle: m.user.handle,
            color: m.user.color,
            descWordsAdded: 0,
            descEdits: 0,
            commentCount: 0,
            commentWords: 0,
          })),
        })),
      });
    }

    // Fetch description versions and comments in parallel
    const [descVersions, comments] = await Promise.all([
      prisma.taskDescriptionVersion.findMany({
        where: { taskId: { in: taskIds } },
        select: { taskId: true, userId: true, content: true, createdAt: true },
        orderBy: [{ taskId: "asc" }, { createdAt: "asc" }],
      }),
      prisma.comment.findMany({
        where: { taskId: { in: taskIds } },
        select: { taskId: true, author: true, content: true },
      }),
    ]);

    // --- Description contributions ---
    // Group versions by taskId (already sorted by taskId+createdAt from query)
    const versionsByTask = new Map<string, typeof descVersions>();
    for (const v of descVersions) {
      const arr = versionsByTask.get(v.taskId) ?? [];
      arr.push(v);
      versionsByTask.set(v.taskId, arr);
    }

    // userId -> { wordsAdded, edits }
    const descStats = new Map<string, { wordsAdded: number; edits: number }>();
    for (const [, versions] of versionsByTask) {
      for (let i = 0; i < versions.length; i++) {
        const cur = versions[i];
        const prevWords = i > 0 ? wordCount(versions[i - 1].content) : 0;
        const delta = wordCount(cur.content) - prevWords;
        const s = descStats.get(cur.userId) ?? { wordsAdded: 0, edits: 0 };
        s.edits += 1;
        if (delta > 0) s.wordsAdded += delta;
        descStats.set(cur.userId, s);
      }
    }

    // --- Comment contributions ---
    // Comments store the author string baked in at write time. Map every stable
    // identifier for each user so name changes break as few lookups as possible.
    // Full fix requires adding userId to the Comment model (migration needed).
    const authorToUserId = new Map<string, string>();
    for (const g of groups) {
      for (const m of g.board.members) {
        const { id: uid, handle, name, email } = m.user;
        if (handle) authorToUserId.set(`@${handle}`, uid);
        if (name && name.trim()) authorToUserId.set(name.trim(), uid);
        if (email) authorToUserId.set(email, uid);
        const override = nameOverrides.get(uid);
        if (override) authorToUserId.set(override, uid);
      }
    }

    // userId -> { count, words }
    const commentStats = new Map<string, { count: number; words: number }>();
    for (const c of comments) {
      const uid = authorToUserId.get(c.author);
      if (!uid) continue;
      const s = commentStats.get(uid) ?? { count: 0, words: 0 };
      s.count += 1;
      s.words += wordCount(c.content);
      commentStats.set(uid, s);
    }

    // --- Assemble result ---
    const resultGroups = groups.map((g) => ({
      groupId: g.id,
      name: g.name,
      boardId: g.boardId,
      members: g.board.members.filter((m) => !nonStudentIds.has(m.user.id)).map((m) => {
        const uid = m.user.id;
        const displayName = nameOverrides.get(uid) || m.user.name || (m.user.handle ? `@${m.user.handle}` : "Unknown");
        const desc = descStats.get(uid) ?? { wordsAdded: 0, edits: 0 };
        const cmts = commentStats.get(uid) ?? { count: 0, words: 0 };
        return {
          userId: uid,
          name: displayName,
          handle: m.user.handle,
          color: m.user.color,
          descWordsAdded: desc.wordsAdded,
          descEdits: desc.edits,
          commentCount: cmts.count,
          commentWords: cmts.words,
        };
      }),
    }));

    return NextResponse.json({ groups: resultGroups });
  } catch (error) {
    console.error("Failed to load participation:", error);
    return NextResponse.json({ error: "Failed to load participation." }, { status: 500 });
  }
}
