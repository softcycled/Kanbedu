import { NextResponse } from "next/server";
import { getSession, revokeAllSessions, createSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// POST: sign out of all other devices. Moves the user's session cutoff to now
// (invalidating every existing token), then re-issues a fresh token for THIS
// device so the caller stays logged in. Other devices drop on their next
// request.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const ip = getClientIp(req);
  const limit = await checkRateLimit(ip, "logout_all", 10, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    await revokeAllSessions(session.userId);
    // Re-issue this device's token. Its iat lands at or after the (second-
    // floored) cutoff, so it survives while older tokens are rejected.
    await createSession(session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to sign out other sessions:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
