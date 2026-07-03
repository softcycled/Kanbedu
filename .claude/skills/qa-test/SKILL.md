---
name: qa-test
description: Use when manually QA-testing Kanbedu changes against a real local dev server — starting/restarting the dev server safely, logging in as a test account, and driving the app with Playwright to verify a fix or feature actually works. Covers the recurring gotchas hit repeatedly in past sessions (orphaned dev-server processes, .env vs .env.local, rate limiting, login flow). Not for unit/integration tests (use `npx vitest run`) — this is for "does the UI actually behave correctly when a real browser hits it."
---

# QA-testing Kanbedu against a live dev server

## 1. Check for an orphaned dev server before starting a new one

A `next dev` process started in an earlier turn can survive being "stopped" if only
the wrapper was killed — it keeps holding port 3000 and serves stale/broken state
(seen: "Cannot find the middleware module" 500s, Turbopack panics with exit code
`0xc0000142`). Always check first:

```bash
netstat -ano | grep ":3000" | awk '{print $5}' | sort -u
```

If a PID shows up, confirm it's actually a leftover `next-server` (not something the
user/VSCode needs) before killing it:

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select-Object CommandLine
```

Look for `node_modules\next\dist\server\lib\start-server.js` in the command line.
If confirmed, kill it (`taskkill //F //PID <pid>`), then if a Turbopack panic was
involved, clear the cache before restarting:

```powershell
Remove-Item -Recurse -Force -Path "<repo>\.next" -ErrorAction SilentlyContinue
```

## 2. Start the dev server and verify it's actually healthy

```bash
npm run dev   # run with run_in_background: true
```

Don't just check "Ready in Nms" in the log — that doesn't catch the middleware-module
or Turbopack-panic failure modes. Confirm with an actual request:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # expect 200
```

If it's not 200, go back to step 1 — don't debug app code for what's actually a stale
server.

## 3. Local DB gotcha — `.env` vs `.env.local`

The Next app reads `.env.local` (local Postgres). Any standalone Node/Prisma script
run directly (not through `npm run dev`) defaults to reading `.env` instead (cloud
Neon DB) unless told otherwise. Force it explicitly in any one-off script:

```js
require('dotenv').config({ path: '.env.local', override: true });
```

## 4. Clear the rate limit table before testing login/signup repeatedly

Signup/login is rate-limited 5/IP/hour; local IP resolves as "unknown" so repeated
test runs exhaust it fast. Clear it before a testing session:

```js
require('dotenv').config({ path: '.env.local', override: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => { await prisma.rateLimit.deleteMany({}); await prisma.$disconnect(); })();
```

## 5. Log in once, reuse the session

Don't log in fresh in every test script — save a Playwright `storageState` once and
reuse it. Known working local account: credentials in `.env.local` as `QA_EMAIL` / `QA_PASSWORD`
(real account, also owns the demo seed data — see `prisma/seed.ts`).

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[placeholder="you@example.com"]', process.env.QA_EMAIL ?? '');
  await page.fill('input[placeholder="Your password"]', process.env.QA_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await context.storageState({ path: '<scratch-dir>/session.json' });
  await browser.close();
})();
```

Then reuse it in subsequent scripts: `newContext({ storageState: '<scratch-dir>/session.json' })`.

## 6. Drive the actual check, screenshot, read the screenshot

Standard loop: `page.goto` → fill/click the thing being tested → `page.screenshot()`
→ use the Read tool on the screenshot to actually look at it. Also wire up error
capture so a silently-broken page doesn't look like a pass:

```js
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));
```

Common selector trap: when both a mobile and desktop instance of the same component
exist in the DOM simultaneously (Tailwind `md:hidden` / `hidden md:flex` toggles
`display`, not mount state), a bare `page.click('text=X')` may hit the wrong one.
Scope with `.first()` / `.last()` or a more specific selector.

## 7. Clean up test data before finishing

Any QA test that writes to the database (roster imports, task creation, etc.) must
clean up after itself. The "Testing" class (`cmqahs8se0009jun7defxy04p`) is shared
— educators can see Monitor/Integrity/Roster data from it.

**Always add a cleanup step at the end of test scripts:**

```js
require('dotenv').config({ path: '.env.local', override: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  // Remove only the specific rows this test added — never deleteMany without a where clause
  await prisma.classRosterEntry.deleteMany({
    where: {
      classId: 'cmqahs8se0009jun7defxy04p',
      email: { in: ['qa-test-one@example.com', 'qa-test-two@example.com'] },
    },
  });
  await prisma.$disconnect();
}
```

Rules:
- Always scope deletes to the specific rows the test created (by email, by ID, etc.)
- Never `deleteMany({})` without a `where` clause — that wipes everything
- Use the local Prisma client (`dotenv .env.local`), not the cloud DB
- Delete the `.qa/` scratch dir and screenshots after every session (`git status --short` to confirm)
- Stop the dev server (`TaskStop` on its task ID) unless the user is still using it
