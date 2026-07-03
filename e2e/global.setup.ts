import { test as setup } from "@playwright/test";
import fs from "fs";

// Logs in once and saves the session cookie so all tests reuse it.
// Re-run this if the session expires: npx playwright test --project=setup
setup("authenticate", async ({ page }) => {
  if (!process.env.QA_EMAIL || !process.env.QA_PASSWORD) {
    // No credentials: write an empty session so the anonymous specs
    // (api-auth, auth-flow redirects) can still run. Authed specs skip themselves.
    fs.mkdirSync("e2e/.auth", { recursive: true });
    fs.writeFileSync("e2e/.auth/session.json", JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, "QA_EMAIL/QA_PASSWORD not set; authenticated specs will skip.");
    return;
  }

  await page.goto("/login");
  await page.fill('input[placeholder="you@example.com"]', process.env.QA_EMAIL);
  await page.fill('input[placeholder="Your password"]', process.env.QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
