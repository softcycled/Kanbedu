# E2E tests (Playwright)

Browser-level regression tests. They run against a live server at `localhost:3000` and are NOT
part of CI (CI runs vitest + tsc only). Run them locally before releases.

## Requirements

1. A running dev server: `npm run dev` (must be on `http://localhost:3000`, not 127.0.0.1).
2. The server must point at a LOCAL database, never production. Check what `DATABASE_URL` the
   Next app resolves before running anything.
3. Test account credentials in `.env.local`:
   - `QA_EMAIL` / `QA_PASSWORD`: an existing account. For the full critical-path suite it should
     be an educator with at least one class. Without these, only the anonymous specs run
     (401 matrix, redirects); authed specs skip with a clear reason.

## Running

```
npx playwright test                 # everything except mutation tests
npx playwright test e2e/api-auth.spec.ts   # one file
E2E_MUTATIONS=1 npx playwright test        # include the write-path suite (see below)
```

On Windows PowerShell: `$env:E2E_MUTATIONS = "1"; npx playwright test`.

## What each spec covers

- `api-auth.spec.ts`: every protected API route rejects anonymous requests with 401 through the
  real proxy; tampered tokens rejected; CSRF blocks authenticated mutations without a same-site
  Origin. Safe to run against any target: it only asserts that requests are REFUSED.
- `auth-flow.spec.ts`: anonymous redirects (/ to /landing, protected pages to /login), login form,
  wrong password rejection, real login, logout killing the session. Read-only apart from creating
  sessions.
- `critical-path.spec.ts`: educator smoke tests. Dashboard, class workspace tabs, panels load,
  group board opens, Escape behavior.
- `board-crud.spec.ts`: WRITE-PATH tests. Creates a board named "E2E Sandbox <timestamp>", adds a
  task, drags it between columns, deletes the board, and cleans up any stale sandbox boards.
  Double-gated: skipped unless `E2E_MUTATIONS=1`, and hard-refuses any baseURL that is not
  localhost. Never point this at production.

## Conventions

- Everything the mutation suite creates is prefixed `E2E Sandbox` / `E2E`. Cleanup matches on that
  prefix only.
- New specs that write data must reuse the same double-gate (env flag + localhost assert) and
  clean up after themselves in `afterAll`.
- Specs that need auth must skip cleanly when `QA_EMAIL`/`QA_PASSWORD` are missing, so the
  anonymous suites stay runnable anywhere.
