import { test, expect } from "@playwright/test";

// Auth flow through the browser: redirects for anonymous visitors, the login
// form, bad credentials, a real login, and logout killing the session.
// All tests start anonymous; the ones that need an account use QA_EMAIL/QA_PASSWORD
// and skip cleanly when those are not set.

test.use({ storageState: { cookies: [], origins: [] } });

const QA_EMAIL = process.env.QA_EMAIL;
const QA_PASSWORD = process.env.QA_PASSWORD;
const HAS_CREDS = !!(QA_EMAIL && QA_PASSWORD);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[placeholder="you@example.com"]', QA_EMAIL!);
  await page.fill('input[placeholder="Your password"]', QA_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

test("anonymous visit to / lands on the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/landing/);
});

test("anonymous visit to a protected page redirects to login with a return path", async ({ page }) => {
  await page.goto("/class/e2e-nonexistent-id");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("a tampered session cookie does not grant page access", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "kanbedu-session", value: "not-a-real-jwt", url: baseURL! },
  ]);
  await page.goto("/class/e2e-nonexistent-id");
  await expect(page).toHaveURL(/\/login/);
});

test("login page renders the credentials form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
  await expect(page.locator('input[placeholder="Your password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("wrong password is rejected and stays on the login page", async ({ page }) => {
  test.skip(!HAS_CREDS, "QA_EMAIL/QA_PASSWORD not set");

  await page.goto("/login");
  await page.fill('input[placeholder="you@example.com"]', QA_EMAIL!);
  await page.fill('input[placeholder="Your password"]', "definitely-wrong-password-e2e");

  const loginResponse = page.waitForResponse(
    (res) => res.url().includes("/api/auth/login") && res.request().method() === "POST"
  );
  await page.click('button[type="submit"]');
  const res = await loginResponse;

  expect(res.status()).toBe(401);
  await expect(page).toHaveURL(/\/login/);
});

test("valid credentials log in and the session works", async ({ page }) => {
  test.skip(!HAS_CREDS, "QA_EMAIL/QA_PASSWORD not set");

  await login(page);
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(200);
});

test("logout clears the session", async ({ page, baseURL }) => {
  test.skip(!HAS_CREDS, "QA_EMAIL/QA_PASSWORD not set");

  await login(page);

  // Logout endpoint is a mutation, so it needs a same-origin header for CSRF.
  const res = await page.request.post("/api/auth/logout", {
    headers: { origin: baseURL! },
  });
  expect(res.ok()).toBeTruthy();

  // The cleared cookie must lock the app again.
  await page.goto("/");
  await expect(page).toHaveURL(/\/landing/);
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(401);
});
