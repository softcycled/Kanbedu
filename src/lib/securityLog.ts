// Structured security-event logging. Edge-safe (console only) so it works in
// both middleware and route handlers. Each event is a single tagged JSON line
// so log-based alerting can match on [SECURITY] and on type/ip (configure the
// alert in Sentry or the Vercel log drain). Never log secrets or PII here.
//
// This closes the detection gap: unauthenticated probing, authorization
// denials, CSRF blocks, and admin actions become visible and alertable instead
// of silent. It is also a PDPA dependency — breach notification is impossible
// without breach detection.

export type SecurityEventType =
  | "auth_missing" // protected route hit with no session token
  | "auth_invalid" // token present but invalid or expired
  | "authz_denied" // authenticated but not authorized for the resource (403)
  | "csrf_blocked" // cross-origin state-changing request blocked
  | "admin_action" // privileged admin action performed
  | "admin_denied"; // non-admin attempted an admin-only route

export interface SecurityEvent {
  type: SecurityEventType;
  route: string;
  ip?: string;
  userId?: string;
  detail?: string;
}

export function logSecurityEvent(event: SecurityEvent): void {
  // Logging must never throw into the request path.
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    console.warn(`[SECURITY] ${line}`);
  } catch {
    // ignore serialization/logging failures
  }
}

// Extract the client IP without importing the rate-limit module (keeps this file
// free of Prisma so it stays edge-safe for middleware).
function clientIpFrom(req: { headers: { get(name: string): string | null } }): string | undefined {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const last = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last || undefined;
}

// Convenience wrapper for an authorization denial in a route handler: logs an
// authz_denied event with the caller and route. Call it right before returning
// the 403. detail can note the scope (e.g. "educator-only", "cross-tenant").
export function logAuthzDenied(
  req: { headers: { get(name: string): string | null } },
  route: string,
  userId?: string,
  detail?: string
): void {
  logSecurityEvent({ type: "authz_denied", route, ip: clientIpFrom(req), userId, detail });
}
