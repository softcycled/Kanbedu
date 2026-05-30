import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "kanbedu-session";
const SECRET_RAW = process.env.KANBEDU_JWT_SECRET;
if (!SECRET_RAW) {
  throw new Error("CRITICAL SECURITY FATAL: KANBEDU_JWT_SECRET environment variable is missing.");
}
const SECRET = new TextEncoder().encode(SECRET_RAW);

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/landing", "/terms", "/privacy", "/credits", "/api/auth/", "/invite/", "/api/invites/", "/verify-email/", "/forgot-password", "/reset-password/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApiRoute = pathname.startsWith("/api/");
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  // Allow public routes and static assets
  if (isPublic(pathname) || pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/screenshots/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isApiRoute) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SECRET);
  } catch {
    // Invalid or expired token
    if (isApiRoute) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // CSRF Protection for API Mutations
  const CSRF_COOKIE_NAME = "csrf-token";
  const CSRF_HEADER_NAME = "x-csrf-token";

  if (isApiRoute && isMutation) {
    const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfHeader = req.headers.get(CSRF_HEADER_NAME);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: "CSRF Validation Failed" }, { status: 403 });
    }
  }

  const res = NextResponse.next();

  // Ensure every client gets a CSRF token for future mutations
  if (!req.cookies.has(CSRF_COOKIE_NAME)) {
    res.cookies.set(CSRF_COOKIE_NAME, crypto.randomUUID(), {
      httpOnly: false, // Client needs to read this to attach to headers
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  return res;
}

export const config = {
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
