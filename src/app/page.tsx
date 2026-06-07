import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BoardContainer from "@/components/BoardContainer";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ class?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/landing");

  const sp = await searchParams;
  const classIdParam = typeof sp.class === "string" ? sp.class : undefined;

  // Run user lookup + board memberships in parallel
  let [user, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true, handle: true, emailVerified: true },
    }),
    prisma.boardMember.findMany({
      // Exclude class group boards — those live under Classes, not personal Boards.
      where: { userId: session.userId, board: { group: { is: null } } },
      include: { board: true },
      orderBy: { board: { order: "asc" } },
    }),
  ]);

  let boards = memberships.map((m) => m.board);

  // Existing users without a handle must set one up first
  if (user && !user.handle) redirect("/handle-setup");

  // Hard gate: email must be verified before accessing the app
  if (user && user.emailVerified === false) redirect("/verify-email-required");

  // First-time user: create a default board
  if (boards.length === 0) {
    // If the user record is missing, auto-create a minimal user in non-production
    // to avoid foreign-key errors when creating the initial BoardMember.
    if (!user) {
      if (process.env.NODE_ENV === "production") {
        // In production, don't auto-create users; redirect to landing/signup.
        redirect("/landing");
      } else {
        await prisma.user.upsert({
          where: { id: session.userId },
          create: { id: session.userId, email: `${session.userId}@local.kanbedu`, name: "", color: "#4A90A4" },
          update: {},
        });
        // Refresh `user` value (only need isAdmin for later checks).
        user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isAdmin: true, handle: true, emailVerified: true } });
      }
    }

    const board = await prisma.board.create({
      data: { name: "My Board" },
    });
    await prisma.boardMember.create({
      data: { userId: session.userId, boardId: board.id, role: "owner" },
    });
    await prisma.column.createMany({
      data: [
        { label: "To Do", order: 0, isDone: false, boardId: board.id },
        { label: "In Progress", order: 1, isDone: false, boardId: board.id },
        { label: "Done", order: 2, isDone: true, boardId: board.id },
      ],
    });
    boards = [board];
  }

  const firstBoard = boards[0];

  // Run columns + tasks in parallel — tasks filter by relation instead of prefetching column IDs
  const taskWhere = { columnRel: { boardId: firstBoard.id } };
  const [boardColumns, tasks, taskTotal] = await Promise.all([
    prisma.column.findMany({
      where: { boardId: firstBoard.id },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: {
        _count: { select: { comments: true } },
        assigneeUser: { select: { id: true, name: true, color: true, handle: true } },
        tags: true,
      },
      orderBy: [{ column: "asc" }, { order: "asc" }],
      take: 100,
    }),
    prisma.task.count({ where: taskWhere }),
  ]);

  const serializedTasks = tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    columnUpdatedAt: t.columnUpdatedAt.toISOString(),
    deadline: t.deadline?.toISOString() ?? null,
    // Do NOT serialize full comments for board payloads - keep empty array to preserve shape
    comments: [],
    // Expose a compact comment count for UI
    commentCount: (t as any)._count?.comments ?? 0,
  }));

  const serializedBoards = boards.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }));

  const resolvedIsAdmin = !!user?.isAdmin;

  // Deep-link into a student's class (/?class=<id>): resolve their own group
  // board reference server-side so the class view paints without a flicker.
  // Only ever exposes the caller's own group secret.
  let initialClass = null;
  if (classIdParam) {
    const membership = await prisma.classMember.findUnique({
      where: { userId_classId: { userId: session.userId, classId: classIdParam } },
      include: {
        class: { select: { id: true, name: true, term: true, archived: true } },
        group: { select: { name: true, boardId: true, board: { select: { realtimeSecret: true } } } },
      },
    });
    if (membership && membership.role === "student") {
      initialClass = {
        id: membership.class.id,
        name: membership.class.name,
        term: membership.class.term,
        archived: membership.class.archived,
        role: membership.role,
        myGroupId: membership.groupId,
        groupName: membership.group?.name ?? null,
        boardId: membership.group?.boardId ?? null,
        realtimeSecret: membership.group?.board?.realtimeSecret ?? null,
      };
    }
  }

  return (
    <BoardContainer
      initialTasks={serializedTasks}
      initialBoards={serializedBoards}
      initialBoardId={firstBoard.id}
      initialColumns={boardColumns}
      currentUserId={session.userId}
      isAdmin={resolvedIsAdmin}
      initialClass={initialClass}
      initialTaskTotal={taskTotal}
    />
  );
}
