import { test, expect } from "@playwright/test";

// API access control through the real HTTP stack (proxy included).
// The proxy must reject unauthenticated requests with 401 before any route
// handler runs, and block authenticated mutations without a valid Origin.
// Complements test/access-control.spec.ts which covers per-route authz in vitest.

const HAS_CREDS = !!(process.env.QA_EMAIL && process.env.QA_PASSWORD);

test.describe("unauthenticated requests are rejected", () => {
  // Drop the shared session so every request in this group is anonymous.
  test.use({ storageState: { cookies: [], origins: [] } });

  const CASES: Array<{ method: "get" | "post" | "patch" | "delete"; path: string }> = [
    { method: "get", path: "/api/auth/me" },
    { method: "get", path: "/api/boards" },
    { method: "post", path: "/api/boards" },
    { method: "get", path: "/api/classes" },
    { method: "post", path: "/api/classes" },
    { method: "post", path: "/api/tasks" },
    { method: "get", path: "/api/tasks/deleted" },
    { method: "patch", path: "/api/tasks/e2e-nonexistent-id" },
    { method: "delete", path: "/api/tasks/e2e-nonexistent-id" },
    { method: "get", path: "/api/notifications" },
    { method: "get", path: "/api/columns?boardId=e2e-nonexistent-id" },
    // Nonexistent path under /api must still be 401, not 404: auth runs first.
    { method: "get", path: "/api/e2e-nonexistent-route" },
  ];

  for (const { method, path } of CASES) {
    test(`${method.toUpperCase()} ${path} -> 401`, async ({ request }) => {
      const res = await request[method](path, {
        data: method === "get" ? undefined : {},
      });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });
  }

  test("garbage session token is rejected with 401", async ({ request }) => {
    const res = await request.get("/api/boards", {
      headers: { cookie: "kanbedu-session=not-a-real-jwt" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("CSRF protection on authenticated mutations", () => {
  // Uses the shared authenticated session from global.setup.
  test.beforeEach(() => {
    test.skip(!HAS_CREDS, "QA_EMAIL/QA_PASSWORD not set");
  });

  test("mutation without Origin or Referer is blocked with 403", async ({ request }) => {
    // Playwright's request fixture sends no Origin header by default,
    // which is exactly the cross-site shape the proxy must block.
    const res = await request.post("/api/boards", {
      data: { name: "E2E csrf probe, must never be created" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cross-origin");
  });

  test("mutation with a foreign Origin is blocked with 403", async ({ request }) => {
    const res = await request.post("/api/boards", {
      headers: { origin: "https://evil.example.com" },
      data: { name: "E2E csrf probe, must never be created" },
    });
    expect(res.status()).toBe(403);
  });
});
