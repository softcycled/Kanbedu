import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boardId } = params;

  try {
    const members = await prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: { id: true, name: true, color: true }
        }
      }
    });

    const completedTasks = await prisma.task.findMany({
      where: {
        columnRel: { boardId },
        completedAt: { not: null }
      },
      select: {
        id: true,
        assigneeId: true,
        createdAt: true,
        completedAt: true,
        _count: { select: { columnHistory: true } },
      }
    });

    const completionActivity = await prisma.taskActivity.findMany({
      where: {
        type: "COMPLETE",
        task: {
          columnRel: { boardId }
        }
      },
      select: {
        taskId: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });

    // --- Process Heatmap ---
    const dailyCompletions: Record<string, number> = {};
    const farmedPrevention = new Set<string>();

    for (const act of completionActivity) {
      const dateKey = act.createdAt.toISOString().split("T")[0];
      const farmKey = `${dateKey}_${act.taskId}`;
      if (!farmedPrevention.has(farmKey)) {
        dailyCompletions[dateKey] = (dailyCompletions[dateKey] || 0) + 1;
        farmedPrevention.add(farmKey);
      }
    }

    // --- Process Leaderboard with Integrity Stats ---
    const userStatsMap: Record<string, any> = {};
    for (const m of members) {
      userStatsMap[m.userId] = {
        user: m.user,
        completedCount: 0,
        totalCycleTimeMs: 0,
        suspiciousCount: 0,
      };
    }

    for (const task of completedTasks) {
      if (task.assigneeId && userStatsMap[task.assigneeId]) {
        const stats = userStatsMap[task.assigneeId];
        stats.completedCount++;

        // Cycle Time Calculation
        const cycleTime = task.completedAt!.getTime() - task.createdAt.getTime();
        stats.totalCycleTimeMs += cycleTime;

        // Integrity Flags
        const isSpeedRun = cycleTime < 10 * 60 * 1000; // Under 10 minutes
        const isColumnSkip = task._count.columnHistory < 2; // Directly created and finished?
        
        if (isSpeedRun || isColumnSkip) {
          stats.suspiciousCount++;
        }
      }
    }

    const leaderboard = Object.values(userStatsMap).map((stats: any) => ({
      user: stats.user,
      completedCount: stats.completedCount,
      avgCycleTimeMs: stats.completedCount > 0 ? stats.totalCycleTimeMs / stats.completedCount : null,
      suspiciousCount: stats.suspiciousCount,
    })).sort((a, b) => b.completedCount - a.completedCount);

    return NextResponse.json({
      dailyScores: Object.entries(dailyCompletions).map(([date, count]) => ({ date, score: count })),
      userLeaderboard: leaderboard,
    });

  } catch (error: any) {
    console.error("Activity Stats Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
