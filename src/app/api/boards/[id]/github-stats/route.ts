import { getRepoContributorStats, getRepoContributors, getRepoCommitsSince } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the user is a member of this board
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: session.userId, boardId: id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Get the board and linked repo
    const board = await prisma.board.findUnique({
      where: { id },
      select: { githubRepo: true },
    });

    if (!board || !board.githubRepo) {
      return NextResponse.json({ error: "Board not linked to a GitHub repository" }, { status: 400 });
    }

    // 2. Get the user's access token
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { githubAccessToken: true },
    });

    if (!user || !user.githubAccessToken) {
      return NextResponse.json({ error: "Please connect your GitHub account first" }, { status: 403 });
    }

    const repo = board.githubRepo;
    const token = user.githubAccessToken;

    // One year ago for the heatmap range
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    // 3. Fetch reliable data: contributors + all commits from the last year (paginated)
    const [contributors, commitDates] = await Promise.all([
      getRepoContributors(repo, token),
      getRepoCommitsSince(repo, token, since),
    ]);

    // 4. Try detailed stats once. Skip if GitHub returns 202 (no polling).
    let detailedStats: any[] | null = null;
    try {
      const stats = await getRepoContributorStats(repo, token);
      if (Array.isArray(stats)) {
        detailedStats = stats;
      }
    } catch {
      // Non-critical.
    }

    // 5. Build contributor map, overlaying detailed stats if available
    const contributorMap = new Map<string, any>();

    for (const c of contributors) {
      contributorMap.set(c.login, {
        author: { login: c.login, avatar_url: c.avatar_url },
        total: c.contributions,
        additions: 0,
        deletions: 0,
        hasDetailedStats: false,
      });
    }

    if (detailedStats) {
      for (const s of detailedStats) {
        const login = s.author?.login;
        if (!login) continue;

        const additions = s.weeks?.reduce((acc: number, w: any) => acc + (Number(w.a) || 0), 0) || 0;
        const deletions = s.weeks?.reduce((acc: number, w: any) => acc + (Number(w.d) || 0), 0) || 0;

        const existing = contributorMap.get(login);
        if (existing) {
          existing.additions = additions;
          existing.deletions = deletions;
          existing.hasDetailedStats = true;
        } else {
          contributorMap.set(login, {
            author: { login: s.author.login, avatar_url: s.author.avatar_url },
            total: s.total,
            additions,
            deletions,
            hasDetailedStats: true,
          });
        }
      }
    }

    return NextResponse.json({
      contributors: Array.from(contributorMap.values()),
      commitDates,
      hasDetailedStats: detailedStats !== null,
    });
  } catch (error: any) {
    console.error("GitHub Stats Error:", error.message);
    return NextResponse.json({ error: `GitHub API: ${error.message}` }, { status: 500 });
  }
}
