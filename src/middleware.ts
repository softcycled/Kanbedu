import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "kanbedu-session";
const SECRET_RAW = process.env.KANBEDU_JWT_SECRET ?? "kanbedu-dev-secret-change-in-prod";
const SECRET = new TextEncoder().encode(SECRET_RAW);

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/landing", "/terms", "/privacy", "/credits", "/api/auth/", "/invite/", "/api/invites/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and static assets
  if (isPublic(pathname) || pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    // Invalid or expired token
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
