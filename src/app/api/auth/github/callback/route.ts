import { getGitHubToken, getGitHubUser, getGitHubUserEmails } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", req.url));
  }

  try {
    // 1. Get Access Token
    const { access_token } = await getGitHubToken(code);
    
    // 2. Get User Info
    const ghUser = await getGitHubUser(access_token);
    const emails = await getGitHubUserEmails(access_token);
    const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email || ghUser.email;

    if (!primaryEmail) {
      return NextResponse.redirect(new URL("/login?error=no_email", req.url));
    }

    // 3. Upsert User
    const user = await prisma.user.upsert({
      where: { githubId: String(ghUser.id) },
      update: {
        githubAccessToken: access_token,
        email: primaryEmail, // Keep email in sync if possible
      },
      create: {
        githubId: String(ghUser.id),
        githubAccessToken: access_token,
        email: primaryEmail,
        name: ghUser.name || ghUser.login,
        // No password for GitHub users
      },
    });

    // 4. Create Session
    await createSession(user.id);

    // 5. Redirect to Home
    return NextResponse.redirect(new URL("/", req.url));
  } catch (error) {
    console.error("GitHub Auth Error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
}
