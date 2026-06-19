import { test as setup } from "@playwright/test";

// Logs in once and saves the session cookie so all tests reuse it.
// Re-run this if the session expires: npx playwright test --project=setup
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[placeholder="you@example.com"]', process.env.QA_EMAIL!);
  await page.fill('input[placeholder="Your password"]', process.env.QA_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
