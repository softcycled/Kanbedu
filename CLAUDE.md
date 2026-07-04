# Kanbedu — AI Session Guide

Kanbedu is a classroom kanban tool. Educators create classes, assign students to groups, and each group gets a kanban board. Educators monitor progress through 6 panels (Monitor, Integrity, Participation, Roster, Preset, Settings).

**Real users on production. Stability > everything.**

---

## Stack

- Next.js 16 App Router, React 18, TypeScript strict
- Neon PostgreSQL + Prisma 5. Schema at `prisma/schema.prisma`
- Custom JWT auth (`jose`). No next-auth. Cookie: `kanbedu-session`, 30-day TTL
- Tailwind CSS 3 + CSS variable tokens. No shadcn/radix — fully custom components
- dnd-kit for drag-and-drop. Brevo for email. web-push for notifications
- Deploy: Vercel. Two env files: `.env` (non-secrets) and `.env.local` (local DB + secrets)
- Path alias: `@/` = `src/`. Always use this, never relative up-paths
- **Next.js 16 renamed middleware to proxy**: request interceptor lives in `src/proxy.ts` and must export `proxy` (not `middleware`). The `config` export and matcher stay the same. The old `src/middleware.ts` no longer exists.

---

## Auth pattern (every API route, in order)

```ts
const session = await getVerifiedSession();           // 401 if null
if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

const { id } = await params;                          // Next.js 15+ requires await on params

const role = await getClassRole(session.userId, id);  // 403 if not educator/TA
if (role !== "educator" && role !== "ta")
  return NextResponse.json({ error: "Only educators can do this." }, { status: 403 });
```

Error responses are always `{ error: string }`. Status codes: 400 bad input, 401 not authed, 403 not authorized, 404 not found, 429 rate limited, 500 server error.

Rate limit writes, not reads. Archived class check before every write.

---

## Educator panel shared components

All live in `src/components/class/`. Always use these — never inline the same pattern again:

| Component | Use for |
|---|---|
| `GroupSearchBar` | Search input + "Did you mean" suggestion |
| `SortPills` | Filter/sort pill row |
| `LiveIndicator` | Animated green dot + "Live" label |
| `GroupCardHeader` | Card header with group name, badge, and "Open board" button |

Group search utility: `matchesGroupName(name, query)` and `findGroupSuggestion(allNames, query, excludeSet)` from `src/lib/groupSearch.ts`. **Arg order matters — `name` is always first, `query` second.** This has been reversed before and caused silent mismatch bugs.

---

## Educator panel layout standard

Top row: `flex items-start justify-between gap-4 mb-5`
- Left: `<p className="text-xs text-muted max-w-xl">` description
- Right: contextual stats or controls

Sort row: `flex flex-wrap items-center gap-2 mb-4`
- Left: `<SortPills />`
- Right: `ml-auto` with `<GroupSearchBar />`

Group cards: `rounded-2xl border border-border/70 bg-card-bg`

Empty state (all panels): `"No groups yet. Create groups in the Roster tab."`

---

## ClassWorkspace Escape key

```ts
if (openBoard) { setOpenBoard(null); } else { router.push("/"); }
```

Do not use `!openBoard` — that's the inverted bug that existed before. When a board is open, Escape closes the board. When no board is open, Escape goes home.

RosterPanel dropdown uses `e.stopPropagation()` on its Escape handler so it doesn't bubble up to ClassWorkspace. Preserve this.

---

## Column colors

Always call `resolveColumnPalette(color, index)` from `src/lib/columnPalette.ts`. Never `getColumnPalette(index)` alone. Pass `sortedColumns` (done columns pinned last) as the ordering — the raw DB order is different and produces wrong colors.

---

## Things not to touch without explicit instructions

- `passwordChangedAt` logic in auth — changing this invalidates all live sessions silently
- `KANBEDU_JWT_SECRET` — rotating kills all sessions
- `movedByNonAssignee` flag is class boards only — don't apply to personal boards
- dnd-kit `<DndContext>` always needs an explicit `id` prop — omitting causes SSR hydration mismatches
- Prisma `$transaction` with concurrent writes: use sequential `for...of`, not `Promise.all` inside a transaction
- Realtime/Supabase: package still installed but effectively no-op. Don't remove or re-enable

---

## Hard stops — ask before doing any of these

- `rm -rf`, `mv` overwriting, `push --force`, `branch -D`, `push origin --delete`
- `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without clear scope
- Any Prisma migration (generate, surface for approval — never auto-run)
- Auth/permissions flow changes
- Environment variable changes
- Major architecture replacement
- Deleting more than ~10 files
- Any deployment action or production state change

For big actions (push to main, deploys): respond "Yes, boss?" first, wait for explicit confirmation.

---

## Dev gotchas

**Wrong database:** Prisma CLI reads `.env` → Neon cloud. Next app reads `.env.local` → local Postgres. Running `npx prisma db push` without overriding targets the cloud DB. Force `.env.local` for local migrations.

**Hydration failure:** Use `http://localhost:3000`, never `http://127.0.0.1:3000`. Next 16 blocks `/_next/*` chunks as cross-origin for 127.0.0.1.

**Stale routes:** New API routes can 404 in a long-running `next dev` session. Restart before debugging.

**Orphaned server (Windows):** `taskkill` on the npm wrapper can leave the `next-server` child alive on port 3000. Check with `netstat -ano | grep ":3000"`, verify with `Get-CimInstance Win32_Process` before killing.

**Rate limit:** Signup is 100/IP/hour, login_ip 300/15min, handle_check 200/15min (raised for shared campus networks). Local dev resolves as "unknown" so all local test users share one bucket and can still exhaust it. Clear `RateLimit` table before heavy testing sessions.

**Latency:** Neon baseline is 18-19ms/query. This is good. Don't try to fix it. Prisma Accelerate and Neon HTTP adapter were both tried and reverted — don't suggest them again.

**Stale static image after overwriting the same path:** Overwriting a file under `public/` (e.g. swapping a screenshot) can keep serving the old bytes through `next/image` in a running `next dev` session, even after confirming the new file on disk and the raw static route are correct, even with browser HTTP cache disabled, even after restarting the dev server. Deleting only `.next/cache/images` is not enough — it's Turbopack's whole build cache holding a stale reference. Fix: stop the server, delete the entire `.next` directory (not just the images subfolder), then restart.

---

## Copy rules

- No em-dashes (—) anywhere: UI text, commit messages, changelogs, comments. Rewrite the sentence instead.
- No statement pills on marketing/landing pages ("New", "Free", "Beta"). Functional pills inside the product are fine.
- Markdown syntax: `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``, `++underline++` (NOT `__underline__` — dunder names break it)

---

## Branch workflow

Work on `dev`. Push to `main` only on explicit release request. Educators are live on production — `main` deploys immediately.

## Commit style

`fix: subject` not `fix(scope): subject`. No brackets. Body only when tradeoff or loose end is non-obvious.
