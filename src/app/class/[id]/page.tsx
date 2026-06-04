import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClassWorkspace, { WorkspaceGroup } from "@/components/class/ClassWorkspace";

export const dynamic = "force-dynamic";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/landing");

  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      groups: {
        orderBy: { order: "asc" },
        include: { board: { select: { realtimeSecret: true } } },
      },
      members: { select: { userId: true, role: true, groupId: true } },
    },
  });
  if (!cls) redirect("/");

  const me = cls.members.find((m) => m.userId === session.userId);
  if (!me) redirect("/"); // not a member of this class

  const role = me.role as "educator" | "ta" | "student";
  const isEducator = role === "educator" || role === "ta";

  let groups: WorkspaceGroup[];
  if (isEducator) {
    groups = cls.groups.map((g) => ({
      id: g.id,
      name: g.name,
      boardId: g.boardId,
      realtimeSecret: g.board.realtimeSecret ?? null,
    }));
  } else {
    // Students only receive their own group's board reference + secret.
    const mine = cls.groups.find((g) => g.id === me.groupId);
    groups = mine
      ? [{ id: mine.id, name: mine.name, boardId: mine.boardId, realtimeSecret: mine.board.realtimeSecret ?? null }]
      : [];
  }

  const myGroupName = cls.groups.find((g) => g.id === me.groupId)?.name ?? null;

  return (
    <ClassWorkspace
      classId={cls.id}
      name={cls.name}
      term={cls.term}
      archived={cls.archived}
      role={role}
      ownerId={cls.ownerId}
      currentUserId={session.userId}
      joinCode={isEducator ? cls.joinCode : undefined}
      groups={groups}
      myGroupId={me.groupId}
      myGroupName={myGroupName}
    />
  );
}
