---
name: dev-gotchas
description: "Known dev environment traps — wrong DB, stale routes, latency dead ends"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5f1f00a7-e420-470f-bf08-3242e058de33
---

## .env vs .env.local — different databases
- **Prisma CLI** reads `.env` only → targets **Neon cloud DB**
- **Next app** reads `.env.local` (higher precedence) → targets **local Postgres** (`localhost:5432/kanbedu_dev`)
- Running `npx prisma db push` without overriding migrates the **cloud** DB while the app uses local → "table does not exist" 500s
- To migrate local: force `DATABASE_URL`/`DIRECT_URL` from `.env.local` before running Prisma CLI

## localhost not 127.0.0.1
- Always use `http://localhost:3000` in dev, NOT `http://127.0.0.1:3000`
- Next 16 blocks `/_next/*` chunks as cross-origin for `127.0.0.1` → page renders but never hydrates (no click handlers)

## Turbopack stale routes
- New nested API routes can 404 in a long-running `next dev` session even though files exist
- Restart the dev server before debugging — not a code bug

## Orphaned dev server processes (Windows)
- Stopping a background `npm run dev` task (e.g. via the harness's TaskStop, or `taskkill` on the wrong PID) can kill the `npm` wrapper while the actual `next-server` child process survives and keeps holding port 3000.
- Symptom: starting a fresh `npm run dev` says "Port 3000 is in use by process <PID>, using available port 3001 instead" — and that orphaned process serves stale/broken responses (seen: "Cannot find the middleware module" 500s, Turbopack panics with exit code `0xc0000142`).
- Fix: identify the PID holding the port (`netstat -ano | grep ":3000"`), confirm it's actually a leftover `next-server` (`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select CommandLine` — look for `next\dist\server\lib\start-server.js`) before killing it, since the same port could legitimately be held by something the user/VSCode extension is using. Kill it, clear `.next` if a panic occurred, restart.

## Rate limit table
- Signup is rate-limited 5/IP/hour. Local IP resolves as "unknown". Clear the `RateLimit` table when testing signup repeatedly.

## DB latency — don't try to fix it
- Current baseline: **18–19ms per query** on Neon (as of 2026-06-16). This is good.
- **Prisma Accelerate** — abandoned. Only works with Prisma-managed Postgres, not external Neon.
- **Neon HTTP adapter** — abandoned. Caused "Internal server error" on login in prod. Don't retry.
- Do not suggest latency fixes — baseline is already excellent.

## UptimeRobot
- Pings the site every 5 minutes to keep Neon warm. Do not suggest cold start fixes — already handled.
