/**
 * GitHub API Helper functions
 */

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export function getGitHubAuthUrl() {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/github/callback`,
    scope: "read:user user:email repo",
    state: Math.random().toString(36).substring(7),
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function getGitHubToken(code: string) {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) throw new Error("Failed to get GitHub token");
  return res.json();
}

export async function getGitHubUser(accessToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub user");
  return res.json();
}

export async function getGitHubUserEmails(accessToken: string) {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Extracts owner/repo from a GitHub URL or returns the string if already in that format
 */
export function sanitizeRepo(input: string): string {
  const trimmed = input.trim();
  // Handle https://github.com/owner/repo
  const match = trimmed.match(/github\.com\/([^/]+\/[^/]+)/);
  if (match) return match[1].replace(/\/$/, "");
  return trimmed.replace(/\/$/, "");
}

/**
 * Fetches the basic contributor list (instant, no background job needed)
 */
export async function getRepoContributors(repo: string, accessToken: string) {
  const cleanRepo = sanitizeRepo(repo);
  const res = await fetch(`https://api.github.com/repos/${cleanRepo}/contributors?per_page=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

/**
 * Fetches all commit dates since a given ISO date string, paginating up to maxPages.
 * Returns an array of ISO date strings for each commit.
 */
export async function getRepoCommitsSince(
  repo: string,
  accessToken: string,
  since: string,
  maxPages = 5
): Promise<string[]> {
  const cleanRepo = sanitizeRepo(repo);
  const dates: string[] = [];
  let page = 1;

  while (page <= maxPages) {
    const res = await fetch(
      `https://api.github.com/repos/${cleanRepo}/commits?since=${since}&per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) break;

    const commits = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) break;

    for (const c of commits) {
      const date = c.commit?.author?.date;
      if (date) dates.push(date);
    }

    if (commits.length < 100) break;
    page++;
  }

  return dates;
}

/**
 * Fetches contributor stats for a repository
 */
export async function getRepoContributorStats(repo: string, accessToken: string) {
  const cleanRepo = sanitizeRepo(repo);
  const res = await fetch(`https://api.github.com/repos/${cleanRepo}/stats/contributors`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  
  if (res.status === 202) {
    // GitHub is calculating stats, need to retry later
    return { status: "processing" };
  }
  
  if (res.status === 204) {
    // Repository is empty or has no contributor data
    return [];
  }
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || `Failed to fetch contributor stats: ${res.status}`;
    throw new Error(message);
  }
  
  return res.json();
}
