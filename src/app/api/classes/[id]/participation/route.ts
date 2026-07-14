import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, getClassRole } from "@/lib/auth";
import { logSecurityEvent } from "@/lib/securityLog";
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
      logSecurityEvent({ type: "authz_denied", route: "/api/classes/[id]/participation", userId: session.userId, detail: "educator-only" });
      return NextResponse.json({ error: "Only educators can view participation." }, { status: 403 });
    }

    const [groups, nameOverrides, classMembers] = await Promise.all([
      prisma.group.findMany({
        where: { classId: id },
        orderBy: { order: "asc" },
        take: 200,
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
      where: { column: { in: allColumnIds }, deletedAt: null },
      select: { id: true, column: true },
    });

    // task -> board, so contributions are attributed to the board they actually
    // happened on. Without this, a student's historical words/comments follow
    // them to a new group after a Roster reassignment, and the old group
    // silently loses credit for the work they did before the move.
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

    // 90-day cutoff on description versions matches the integrity route and
    // prevents runaway memory on large classes with long edit histories.
    const versionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [descVersions, comments, trimmedTaskRows] = await Promise.all([
      prisma.taskDescriptionVersion.findMany({
        where: { taskId: { in: taskIds }, createdAt: { gte: versionCutoff } },
        select: { taskId: true, userId: true, content: true, createdAt: true },
        orderBy: [{ taskId: "asc" }, { createdAt: "asc" }],
      }),
      prisma.comment.findMany({
        where: { taskId: { in: taskIds } },
        select: { taskId: true, author: true, userId: true, content: true },
      }),
      // Tasks with description history older than the cutoff, so the earliest
      // in-window version isn't mistaken for the description's true starting
      // point — a task that's been open longer than 90 days would otherwise
      // have its whole pre-existing content credited to whoever saved it next.
      prisma.taskDescriptionVersion.findMany({
        where: { taskId: { in: taskIds }, createdAt: { lt: versionCutoff } },
        select: { taskId: true },
        distinct: ["taskId"],
      }),
    ]);
    const trimmedTaskIds = new Set(trimmedTaskRows.map((r) => r.taskId));

    // --- Description contributions ---
    // Group versions by taskId (already sorted by taskId+createdAt from query)
    const versionsByTask = new Map<string, typeof descVersions>();
    for (const v of descVersions) {
      const arr = versionsByTask.get(v.taskId) ?? [];
      arr.push(v);
      versionsByTask.set(v.taskId, arr);
    }

    // "boardId:userId" -> { wordsAdded, edits }, scoped per board so a
    // reassigned student's totals stay with the group they actually earned
    // them on instead of following them to wherever they ended up.
    const descStats = new Map<string, { wordsAdded: number; edits: number }>();
    for (const [taskId, versions] of versionsByTask) {
      const boardId = taskToBoardId.get(taskId);
      if (!boardId) continue;
      for (let i = 0; i < versions.length; i++) {
        const cur = versions[i];
        // A trimmed task's word count immediately before our earliest visible
        // version is unknown, so its delta can't be trusted — count the edit,
        // not the words.
        const prevWords = i > 0 ? wordCount(versions[i - 1].content) : trimmedTaskIds.has(taskId) ? wordCount(cur.content) : 0;
        const delta = wordCount(cur.content) - prevWords;
        const key = `${boardId}:${cur.userId}`;
        const s = descStats.get(key) ?? { wordsAdded: 0, edits: 0 };
        s.edits += 1;
        if (delta > 0) s.wordsAdded += delta;
        descStats.set(key, s);
      }
    }

    // --- Comment contributions ---
    // Comments store the author string baked in at write time. Map every stable
    // identifier for each user so name changes break as few lookups as possible.
    // Only comments predating the userId column (added 2026-06-27) need this
    // fallback. If two members share the exact same display name, drop the
    // name from the map rather than guessing which one wrote it.
    const authorToUserId = new Map<string, string>();
    const ambiguousNames = new Set<string>();
    for (const g of groups) {
      for (const m of g.board.members) {
        const { id: uid, handle, name, email } = m.user;
        if (handle) authorToUserId.set(`@${handle}`, uid);
        if (name && name.trim()) {
          const key = name.trim();
          if (authorToUserId.has(key) && authorToUserId.get(key) !== uid) {
            ambiguousNames.add(key);
          } else {
            authorToUserId.set(key, uid);
          }
        }
        if (email) authorToUserId.set(email, uid);
        const override = nameOverrides.get(uid);
        if (override) authorToUserId.set(override, uid);
      }
    }
    for (const key of ambiguousNames) authorToUserId.delete(key);

    // "boardId:userId" -> { count, words }
    const commentStats = new Map<string, { count: number; words: number }>();
    for (const c of comments) {
      const boardId = taskToBoardId.get(c.taskId);
      if (!boardId) continue;
      // Use stored userId when available (new comments); fall back to author
      // string matching for comments posted before the userId migration.
      const uid = c.userId ?? authorToUserId.get(c.author);
      if (!uid) continue;
      const key = `${boardId}:${uid}`;
      const s = commentStats.get(key) ?? { count: 0, words: 0 };
      s.count += 1;
      s.words += wordCount(c.content);
      commentStats.set(key, s);
    }

    // --- Assemble result ---
    const resultGroups = groups.map((g) => ({
      groupId: g.id,
      name: g.name,
      boardId: g.boardId,
      members: g.board.members.filter((m) => !nonStudentIds.has(m.user.id)).map((m) => {
        const uid = m.user.id;
        const displayName = nameOverrides.get(uid) || m.user.name || (m.user.handle ? `@${m.user.handle}` : "Unknown");
        const key = `${g.boardId}:${uid}`;
        const desc = descStats.get(key) ?? { wordsAdded: 0, edits: 0 };
        const cmts = commentStats.get(key) ?? { count: 0, words: 0 };
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
