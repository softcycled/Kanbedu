import { getGitHubAuthUrl } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const url = getGitHubAuthUrl();
  return NextResponse.redirect(url);
}
