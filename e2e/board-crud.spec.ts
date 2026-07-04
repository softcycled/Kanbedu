import { test, expect, request as playwrightRequest, type Page, type Locator } from "@playwright/test";

// Board and task lifecycle: create board, add task, drag between columns,
// delete board. These tests WRITE to the database behind the dev server, so
// they are double-gated:
//   1. E2E_MUTATIONS=1 must be set explicitly, otherwise every test skips.
//   2. baseURL must be localhost, otherwise the suite refuses to run at all.
// Never point this at production. The suite only creates and deletes objects
// whose names start with the E2E prefix, and cleans up after itself.

const MUTATIONS_ON = process.env.E2E_MUTATIONS === "1";
const HAS_CREDS = !!(process.env.QA_EMAIL && process.env.QA_PASSWORD);

const PREFIX = "E2E Sandbox";
const BOARD_NAME = `${PREFIX} ${Date.now()}`;
const TASK_TITLE = "E2E drag me";

function assertLocalTarget(baseURL: string | undefined) {
  if (!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(baseURL)) {
    throw new Error(
      `Refusing to run mutation e2e against non-local target "${baseURL}". ` +
        "These tests create and delete data."
    );
  }
}

// dnd-kit MouseSensor activates after a 5px move, so the drag must jiggle
// past the threshold before heading to the target.
async function dragTo(page: Page, source: Locator, target: Locator) {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error("Missing bounding box for drag source or target");
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 12, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
  await page.mouse.up();
}

async function openSandboxBoard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: BOARD_NAME }).first().click();
  await expect(page.getByText("To Do", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

// The column root is the flex-shrink-0 wrapper around header plus drop zone.
function columnByLabel(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'flex-shrink-0')][1]");
}

test.describe("board and task lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  let boardId: string | null = null;

  test.beforeEach(({ baseURL }) => {
    test.skip(!MUTATIONS_ON, "Mutation e2e disabled. Set E2E_MUTATIONS=1 against a local target.");
    test.skip(!HAS_CREDS, "QA_EMAIL/QA_PASSWORD not set");
    assertLocalTarget(baseURL);
  });

  test("create a sandbox board with default columns", async ({ page }) => {
    await page.goto("/");
    await page.locator('button[title="New board"]').click();
    await page.getByRole("button", { name: "Create board" }).click();
    await page.locator('input[placeholder="Board name…"]').fill(BOARD_NAME);

    const createResponse = page.waitForResponse(
      (res) => res.url().includes("/api/boards") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const res = await createResponse;
    expect(res.status()).toBe(201);
    boardId = (await res.json()).id;

    await expect(page.getByText(BOARD_NAME).first()).toBeVisible({ timeout: 10_000 });
    await openSandboxBoard(page);
    for (const label of ["To Do", "In Progress", "Done"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("add a task and it survives a reload", async ({ page }) => {
    await openSandboxBoard(page);

    await page.getByRole("button", { name: /Add (your first )?task/ }).first().click();
    await page.getByLabel("Task title").fill(TASK_TITLE);

    const taskResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/tasks") && res.request().method() === "POST"
    );
    await page.keyboard.press("Enter");
    const res = await taskResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByText(TASK_TITLE).first()).toBeVisible();

    await openSandboxBoard(page);
    await expect(page.getByText(TASK_TITLE).first()).toBeVisible({ timeout: 10_000 });
  });

  test("drag the task to In Progress and it persists", async ({ page }) => {
    await openSandboxBoard(page);

    const card = page.getByText(TASK_TITLE).first();
    await expect(card).toBeVisible();

    // Drop onto the Add task button inside the target column: it sits inside
    // the droppable zone and is always present, even in an empty column.
    const target = columnByLabel(page, "In Progress").getByRole("button", { name: "Add task" });

    const moveResponse = page.waitForResponse(
      (res) => /\/api\/tasks\/[^/]+$/.test(res.url()) && res.request().method() === "PATCH"
    );
    await dragTo(page, card, target);
    const res = await moveResponse;
    expect(res.ok()).toBeTruthy();

    // Verify against the API, not the DOM: the task's column id must resolve
    // to the In Progress column.
    expect(boardId).not.toBeNull();
    const [tasksRes, columnsRes] = await Promise.all([
      page.request.get(`/api/tasks?boardId=${boardId}&take=0`),
      page.request.get(`/api/columns?boardId=${boardId}`),
    ]);
    expect(tasksRes.ok()).toBeTruthy();
    expect(columnsRes.ok()).toBeTruthy();

    const tasks: Array<{ title: string; column: string }> = await tasksRes.json();
    const columns: Array<{ id: string; label: string }> = await columnsRes.json();
    const task = tasks.find((t) => t.title === TASK_TITLE);
    expect(task).toBeTruthy();
    const column = columns.find((c) => c.id === task!.column);
    expect(column?.label).toBe("In Progress");

    // And the move survives a reload.
    await openSandboxBoard(page);
    await expect(page.getByText(TASK_TITLE).first()).toBeVisible({ timeout: 10_000 });
  });

  test("delete the sandbox board", async ({ page, baseURL }) => {
    expect(boardId).not.toBeNull();

    const res = await page.request.delete(`/api/boards/${boardId}`, {
      headers: { origin: baseURL! },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto("/");
    await expect(page.getByRole("button", { name: BOARD_NAME })).toHaveCount(0);
    boardId = null;
  });

  // Safety net: remove any sandbox boards left behind by failed or aborted
  // runs, matched strictly by the E2E prefix so nothing else can be touched.
  test.afterAll(async ({ baseURL }) => {
    if (!MUTATIONS_ON || !HAS_CREDS || !baseURL) return;
    assertLocalTarget(baseURL);

    const ctx = await playwrightRequest.newContext({
      baseURL,
      storageState: "e2e/.auth/session.json",
      extraHTTPHeaders: { origin: baseURL },
    });
    try {
      const res = await ctx.get("/api/boards");
      if (!res.ok()) {
        console.error(`e2e cleanup: could not list boards (${res.status()})`);
        return;
      }
      const boards: Array<{ id: string; name: string }> = await res.json();
      for (const board of boards.filter((b) => b.name.startsWith(PREFIX))) {
        const del = await ctx.delete(`/api/boards/${board.id}`);
        if (!del.ok()) {
          console.error(`e2e cleanup: failed to delete "${board.name}" (${del.status()})`);
        }
      }
    } finally {
      await ctx.dispose();
    }
  });
});
