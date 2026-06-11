import { prisma } from "@/lib/prisma";

// Educator-set display names (from CSV roster import) override self-chosen
// account names in every class context, so lecturers see "Chris" instead of
// "JohnABC123". These helpers resolve the override map for a given scope.

// userId -> displayName for one class. Only rows with an override are included.
export async function getClassNameOverrides(classId: string): Promise<Map<string, string>> {
  const members = await prisma.classMember.findMany({
    where: { classId, displayName: { not: null } },
    select: { userId: true, displayName: true },
  });
  return new Map(members.map((m) => [m.userId, m.displayName!]));
}

// Same map, but resolved from a board: group boards belong to a class, personal
// boards don't (empty map = no overrides apply).
export async function getBoardNameOverrides(boardId: string): Promise<Map<string, string>> {
  const group = await prisma.group.findUnique({
    where: { boardId },
    select: { classId: true },
  });
  if (!group) return new Map();
  return getClassNameOverrides(group.classId);
}
