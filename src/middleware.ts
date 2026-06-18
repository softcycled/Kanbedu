import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "kanbedu-session";
const SECRET_RAW = process.env.KANBEDU_JWT_SECRET;
if (!SECRET_RAW) {
  throw new Error("CRITICAL SECURITY FATAL: KANBEDU_JWT_SECRET environment variable is missing.");
}
const SECRET = new TextEncoder().encode(SECRET_RAW);

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/landing", "/terms", "/privacy", "/credits", "/api/auth/", "/invite/", "/verify-email/", "/forgot-password", "/reset-password/", "/check-email", "/opengraph-image"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApiRoute = pathname.startsWith("/api/");
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  // Allow public routes and static assets
  if (isPublic(pathname) || pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/screenshots/")) {
    return NextResponse.next();
  }

  // Redirect to /login, remembering where the user was headed so they land back
  // there after authenticating (e.g. a shared class invite link).
  const loginRedirect = () => {
    const url = new URL("/login", req.url);
    const dest = pathname + (req.nextUrl.search || "");
    if (dest && dest !== "/") url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  };

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isApiRoute) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return loginRedirect();
  }

  try {
    await jwtVerify(token, SECRET);
  } catch {
    // Invalid or expired token
    if (isApiRoute) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return loginRedirect();
  }

  // Origin/Referer check for API mutations (CSRF protection)
  if (isApiRoute && isMutation) {
    const host = req.headers.get("host") ?? "";
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const selfOrigin = host ? `${proto}://${host}` : null;

    const normalizeOrigin = (url: string) => {
      try { return new URL(url).origin; } catch { return url.replace(/\/+$/, ""); }
    };

    const allowed = new Set(
      [process.env.NEXT_PUBLIC_APP_URL, selfOrigin]
        .filter(Boolean)
        .map((u) => normalizeOrigin(u as string))
    );

    const origin = req.headers.get("origin");
    let candidate = origin;
    if (!candidate) {
      const referer = req.headers.get("referer");
      if (referer) { try { candidate = new URL(referer).origin; } catch {} }
    }
    if (!candidate || !allowed.has(normalizeOrigin(candidate))) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
