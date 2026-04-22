import { prisma } from "@/lib/prisma";
import BoardContainer from "@/components/BoardContainer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tasks = await prisma.task.findMany({
    include: { comments: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ column: "asc" }, { order: "asc" }],
  });

  // Serialize dates for client
  const serialized = tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    columnUpdatedAt: t.columnUpdatedAt.toISOString(),
    deadline: t.deadline?.toISOString() ?? null,
    comments: t.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <BoardContainer initialTasks={serialized} />
    </div>
  );
}
