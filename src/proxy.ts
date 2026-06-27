import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { logSecurityEvent } from "@/lib/securityLog";

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

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // unsafe-eval only in dev (HMR); nonce replaces unsafe-inline for all inline scripts
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.public.blob.vercel-storage.com https://storage.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Returns NextResponse.next() with the nonce injected into request headers
// and the CSP set on the response. All passthrough responses go through here.
function nextWithNonce(req: NextRequest, nonce: string): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Generate a fresh nonce for every request
  const nonce = btoa(crypto.randomUUID());

  const isApiRoute = pathname.startsWith("/api/");
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  // Allow public routes and static assets
  if (isPublic(pathname) || pathname === "/" || pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/screenshots/")) {
    return nextWithNonce(req, nonce);
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
  const clientIp = req.headers.get("x-real-ip") ?? undefined;
  if (!token) {
    if (isApiRoute) {
      // Unauthenticated hit on a protected API route — the probing signal.
      logSecurityEvent({ type: "auth_missing", route: pathname, ip: clientIp });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return loginRedirect();
  }

  try {
    await jwtVerify(token, SECRET);
  } catch {
    // Invalid or expired token
    if (isApiRoute) {
      logSecurityEvent({ type: "auth_invalid", route: pathname, ip: clientIp });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
      logSecurityEvent({ type: "csrf_blocked", route: pathname, ip: clientIp, detail: candidate ?? "no-origin" });
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  return nextWithNonce(req, nonce);
}

export const config = {
  // Run on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
