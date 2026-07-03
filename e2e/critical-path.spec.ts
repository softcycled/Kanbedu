import { test, expect } from "@playwright/test";

// Critical path tests — if any of these fail, something fundamental is broken.
// Run with: npx playwright test (dev server must be running on localhost:3000)

// Requires the authenticated educator session from global.setup.
test.beforeEach(() => {
  test.skip(!process.env.QA_EMAIL || !process.env.QA_PASSWORD, "QA_EMAIL/QA_PASSWORD not set");
});

// Navigate to the first educator class via the sidebar "teaching" button
async function openFirstClass(page: import("@playwright/test").Page) {
  await page.goto("/");
  // The sidebar renders educator classes with a "teaching" badge inside the button
  const classBtn = page.locator("button").filter({ hasText: "teaching" }).first();
  await expect(classBtn).toBeVisible({ timeout: 8_000 });
  await classBtn.click();
  await page.waitForURL(/\/class\//, { timeout: 10_000 });
}

test("dashboard loads without error", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login/);
  // Page renders without a crash
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("class workspace opens with all 6 tabs", async ({ page }) => {
  await openFirstClass(page);
  for (const tab of ["Monitor", "Integrity", "Participation", "Roster", "Preset", "Settings"]) {
    await expect(page.getByRole("button", { name: tab })).toBeVisible();
  }
});

test("Monitor tab loads without error", async ({ page }) => {
  await openFirstClass(page);
  // Monitor is the default tab
  const content = page.locator("text=No groups yet").or(page.locator(".rounded-2xl").first());
  await expect(content).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Failed to load")).not.toBeVisible();
});

test("Integrity tab loads without error", async ({ page }) => {
  await openFirstClass(page);
  await page.getByRole("button", { name: "Integrity" }).click();
  // Wait for loading skeleton to disappear
  await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Failed to load")).not.toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("Participation tab loads without error", async ({ page }) => {
  await openFirstClass(page);
  await page.getByRole("button", { name: "Participation" }).click();
  await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Failed to load")).not.toBeVisible();
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});

test("Roster tab loads without error", async ({ page }) => {
  await openFirstClass(page);
  await page.getByRole("button", { name: "Roster" }).click();
  await expect(page.locator("text=Roster")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Failed to load")).not.toBeVisible();
});

test("group board opens and Escape returns to workspace", async ({ page }) => {
  await openFirstClass(page);
  // Wait for Monitor to finish loading
  await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 10_000 });

  // Monitor cards are full-width buttons; skip if class has no groups
  const openBoardBtn = page.locator("button.text-left.rounded-2xl").first();
  if (await openBoardBtn.count() === 0) { test.skip(); return; }

  await openBoardBtn.click();
  await expect(page.locator("text=Back")).toBeVisible({ timeout: 8_000 });

  // Escape must close the board and return to class workspace (tabs visible again)
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Monitor" })).toBeVisible({ timeout: 5_000 });
});

test("group board loads tasks", async ({ page }) => {
  await openFirstClass(page);
  await expect(page.locator(".animate-pulse").first()).not.toBeVisible({ timeout: 10_000 });

  const openBoardBtn = page.locator("button.text-left.rounded-2xl").first();
  if (await openBoardBtn.count() === 0) { test.skip(); return; }

  await openBoardBtn.click();
  await expect(page.locator("text=Back")).toBeVisible({ timeout: 8_000 });

  const column = page.locator("text=To Do").or(page.locator("text=In Progress")).or(page.locator("text=Done"));
  await expect(column.first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Something went wrong")).not.toBeVisible();
});
