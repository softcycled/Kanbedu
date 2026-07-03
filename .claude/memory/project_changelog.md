---
name: project-changelog
description: Session log + pending items + settled decisions. Read this first in every new chat.
metadata: 
  node_type: memory
  type: project
  originSessionId: 44280418-cc6b-42da-80d5-fda280a221c5
---

# Kanbedu — Session Log

## Pending / Not Yet Built (as of 2026-07-03)

**Waiting on user decision**
- Commits `92cd34d` and `e1d2d0d` (2026-07-03 fixes below) are on local `dev` only -- NOT pushed to `origin/dev` or `main`. User asked "commit to dev and main?" but hasn't confirmed scope yet. Push to `origin/dev` is normally the default (no confirmation needed per [[feedback_branch_workflow]]) -- only hold on `main` until explicit release confirmation.

**Infrastructure**
- Replace Brevo with AWS SES (RM 0.40/1000 emails vs free tier 300/day cap)

### Dormant / intentionally deferred
- GitHub OAuth and Discord OAuth -- secrets in .env but no routes wired
- Admin panel -- health check + bug report viewer only (partial)
- Bulk task operations (move/delete/reassign multiple at once)
- Personal board templates (only class presets exist)
- Calendar/timeline view
- Activity export
- TA role -- backend permissions exist but no UI to promote a student to TA

## Known Decisions (do not re-investigate)
- **Students can leave a class themselves** -- already in the UI. Never was a bug. Do not add to to-do list.
- **Activity log for educators** -- removed from scope. Not needed. Do not re-suggest.
- **Staging environment** -- done. Vercel preview deployments on `dev` branch. Do not add to to-do list.
- CSRF requires both `csrf-token` cookie and `x-csrf-token` header -- manual curl needs both.
- `movedByNonAssignee` flag is class-board-only -- ignore it for personal boards.
- Neon HTTP adapter and Prisma Accelerate both tried and reverted (2026-06-09). Don't re-suggest.
- GitHub/Discord OAuth secrets exist but no routes -- don't reference as working. Discord IS used for bug report webhooks (support form -> Discord channel), but that's not OAuth.
- Sentry is installed (@sentry/nextjs, NEXT_PUBLIC_SENTRY_DSN in .env) -- don't re-add it, it's already there.
- Default column accent colors are positional (`resolveColumnPalette(color, index)`) -- reordering shifts unstyled columns' colors. Known, left as-is.
- Analytics/integrity queries: integrity route optimized 2026-06-27 (filter to flagged candidates, select not include). Per-board analytics route is already efficient -- no changes needed there.
- Login lockout is email-keyed, not IP+email. Known trade-off, not a bug.
- **Overnight cloud agent is permanently off** (disabled 2026-06-20, routine trig_01VRfjv2sfDo2PUyqKcNzA3C). Do not re-enable or re-suggest. The `overnight` branch no longer exists.
- **Next.js 16 proxy**: request interceptor is `src/proxy.ts` exporting `export async function proxy(...)`. The old `middleware.ts` is gone. `config` export and matcher syntax unchanged.
- **Vercel Blob replaced by GCS**: all new attachment uploads go to GCS bucket "kanbedu". Vercel Blob code is gone from upload path. Don't suggest reverting or re-adding BLOB_READ_WRITE_TOKEN.
- **Student class board URL is `/?class=[classId]`**, not `/class/[classId]`. The `/class/[id]` route is the educator panel workspace. A student who joins a class lands on `/?class=...`. Don't confuse these two routes in tests or redirects.
- **Soft-delete is the delete mechanism for tasks**: no hard deletes on Task. Tasks sit in trash for 30 days then are lazily purged on trash-list read. Don't re-add hard-delete paths.
- **ProWaitlist is the monetization capture mechanism**: don't add a Stripe or payment flow until the user explicitly requests it. The waitlist comes first.
- **CSV import caps**: `MAX_ROSTER_ROWS = 100` (hard file size limit), `MAX_INVITE_EMAILS = 100` (invite emails per import). Both are 100 as of 2026-06-30. Don't lower them.
- **Invited students skip email verification**: if a student's email matches a `ClassRosterEntry` for the class they're joining, the join route bypasses `emailVerified` and auto-sets it to `true`. Students joining via public code still need verification. Do not re-add the emailVerified gate unconditionally.
- **CSP is nonce-based** (moved to proxy.ts). Do not re-add static CSP to next.config.mjs. The layout is async to read `x-nonce`; inline theme script uses `suppressHydrationWarning`.
- **Account deletion**: `DELETE /api/auth/account` is live. Blocks if user owns classes. No schema migration needed (all handled in application code).
- **IP rate limits are intentionally high**: signup_ip 100/hr, login_ip 300/15min, handle_check 200/15min. Raised 2026-07-02 for shared campus networks. Don't lower them back -- the old 5/hr limit broke signup for whole classrooms sharing one IP.
- **Description history writes on blur/close only**: `recordHistory: true` must be set explicitly in the PATCH body to write a `TaskDescriptionVersion` row. Auto-saves omit it. Don't change this -- the old "record on every debounce tick" created ~100 duplicate entries per edit session. Server-side backstop as of 2026-07-03: `recordDescriptionHistory()` in `route.ts` skips the write if content matches the latest version row, so a client retry/race can't create a duplicate.
- **`Board.tsx`'s `handleUpdateTask` (the `onUpdate` prop passed to `TaskModal`) returns `Promise<boolean>`, not `Promise<void>`, as of 2026-07-03**. It handles its own failure UI (revert optimistic state + toast) internally and does NOT throw on failure -- callers that need to know whether a save actually landed must check the returned boolean, not wrap it in try/catch. `TaskModal`'s `handleUpdateWithFeedback` does this. Don't revert to throw-based error handling here without updating both sides.

---

## Session Log

### 2026-07-03 (business strategy session, no code changes)
Jorge (18, first startup) set a goal: RM10k/month before age 22. Strategy discussion outcomes, directionally agreed:
- Prod snapshot pulled: 83 users, 3 educators, 5 classes, 0 waitlist signups. Pre-semester quiet, 8-9 educators expected at semester start via W.
- W hesitated even at RM20/month -- read as "individual lecturers are the wrong buyer," not "price too high."
- Direction: W becomes free-for-life Founding Educator (Jorge to tell him); target the department license (W's Foundation in Computing dept) as the real revenue path; this semester = evidence-gathering (usage stats + testimonials), pitch dept budget owner mid-semester. Individual RM20 Pro tier is plan B.
- Stripe over Paddle (Stripe has Malaysia entity + FPX). No billing build until demand validated. Blocker: Jorge needs a bank account (only has TnG eWallet).
- **PLAYBOOK.md written to repo root (2026-07-04)**: full Sep 2026 - Jan 2027 semester playbook. Covers prerequisites, Pro-launch gates (plumbing + free-tier limit + demand evidence, NOT waitlist count), September onboarding week, evidence engine, department pitch (RM1,500-3,000/yr opening price), referral loop, kill criteria, weekly rhythm. Treat it as the operating plan; keep it updated as things complete.
- Also this session: created `.claude/settings.json` with 6 read-only permission allowlist entries (fallback; bypassPermissions already on globally).

### 2026-07-03 (max-effort review of description-history commit + fixes)
Ran a local max-effort code review (10 finder agents + verifiers + gap sweep) on commit `0d99c7e` (blur/close description history). Found 14 issues, fixed all of them, verified live against a real browser session before committing. Not yet pushed -- see Pending section above.

- **Root cause of the most severe bug**: `Board.tsx`'s `handleUpdateTask` caught its own fetch errors internally (revert + toast) and never rethrew, so `TaskModal`'s retry-on-next-flush logic could never actually detect a failed save -- the "already recorded" ref advanced regardless of success. Fixed by making `handleUpdateTask` return `Promise<boolean>` and having the caller check it (see Known Decisions above). Verified with a forced 500 on the recordHistory PATCH: history stays unrecorded after the failure, then correctly retries and records on the next flush.
- **Unmount/navigation flush added**: switching boards or navigating away mid-edit never flushed pending description/assignee/deadline changes (no beforeunload/unmount handling existed at all). Added a flush in `TaskModal`'s unmount cleanup, plus a `visibilitychange` flush for tab switches/backgrounding.
- **Escape-cancel bug fixed**: pressing Escape while editing a description could still PATCH and history-record the discarded text, because unmounting the textarea fires a native blur whose closure held the pre-revert value. Added a `skipNextBlurFlushRef` guard set right before the revert.
- **Description-history panel cross-task leak fixed**: the `versions` list was never reset on task switch, so opening history on task A then clicking task B could show A's entries under B. Fixed by resetting `versions` in the full-resync path, and refetching when a new entry is recorded in the same session (`historyStaleRef`).
- **Same-task reopen fixed**: `TaskModal` stays mounted with a nullable `task` prop (never truly unmounts on close), so reopening the same task skipped re-sync. Added a `wasClosedRef` to force a full resync on reopen -- but NOT a reset of the description-history baseline specifically (that stays sticky across reopen so a pending failed-save retry isn't clobbered; only a genuine task-id change resets it).
- **Server-side dedupe backstop added**: `recordDescriptionHistory()` helper in `route.ts` skips the version-row insert if content matches the latest recorded version, consolidating what was previously two independently-drifting fast/slow-path code blocks.
- **`Board.tsx` optimistic state pollution fixed**: the client-only `recordHistory` flag no longer leaks into in-memory `Task` objects via the optimistic `{...t, ...data}` spread.
- k6 load-test scripts (`k6-load-test.js`, `k6-limit-test.js`) had their duplicated login/header setup extracted into `load/k6-common.js`.
- Also fixed a stale rate-limit number in CLAUDE.md's dev gotchas (still said 5/hr from before the 2026-07-02 raise) -- separate commit `92cd34d`.
- Cleanup: deleted the 3 leftover QA test tasks from the "Web App Group Project" personal board (`QA soft-delete test`, `QA Test Task Delete Me`, `QA Automated Test Task`) and their related rows.

### 2026-07-02 (mobile landing nav + signup UX + rate limits + description history)

**Landing nav mobile hamburger** (commits `e0ea5b3`-`fa0dee3`): Full overhaul across ~8 commits. Final design: full-screen opaque overlay below 72px nav, large left-aligned links, sibling of `<nav>` (not child) to escape backdrop-filter stacking context. Outside-tap closes via dual useRef (hamburger + overlay) to avoid mousedown-before-click race. Escape key, body scroll lock, resize-to-desktop close, correct aria-label all working. LandingNav is in `src/components/landing/LandingNav.tsx`.

**Signup form UX** (`b067b46`): Two bugs fixed: (1) non-429 handle-check errors mapped to "invalid" instead of staying idle -- wrong branch order in status mapping. (2) stale form error persisting while typing in the handle field -- onChange now clears `error` state on every keystroke.

**Rate limits raised for campus networks** (`508c292`, `6b524e3`): Signup 5/hr -> 100/hr, handle_check 50/15min -> 200/15min, login_ip raised to 300/15min, reset_password_ip to 100/hr. All IP-keyed limits raised because many students share one campus IP. CLAUDE.md dev gotcha updated to match.

**Description history on blur/close only** (`0d99c7e`): Auto-save (600ms debounce) still saves content every tick but now sends without `recordHistory`. The server only writes a `TaskDescriptionVersion` row and "Updated the description" activity when `recordHistory === true`. Client sets it in `flushUpdates` (textarea blur + modal close) by checking `descriptionLastRecordedRef`. Eliminates ~100 duplicate history entries per 60-second edit session.

### 2026-07-01 (QA sweep -- Playwright visual verification)

Full Playwright sweep across all 6 educator panels, group boards, personal boards, mobile, and edge cases. 73/73 vitest unit tests pass. Key findings -- all clean:
- Monitor: 3 group cards rendered correctly, search/filter works, "Live" indicator present, progress bars and member avatars correct.
- Integrity: 7 flagged tasks surfaced across 3 groups; speed-run/skipped-column badges correct; sort pills and Open board links work.
- Participation: all groups show per-student word/comment counts; sort pills (Total/Descriptions/Comments/A-Z) present; search works.
- Roster: 9 students + 2 waiting shown correctly; group columns with drag-to-assign; Open board + X on each group; + Add group visible.
- Preset: columns + seed tasks editable; Done column toggle works; + Add column and + Add seed task present.
- Settings: class invite link + QR Code button; class name/term editable; Reuse Next Semester / Clone class; Archive + Delete class visible.
- Group board: opens from "Open board" button; kanban columns (To Do, In Progress, Done) render with tasks; Back button works; Escape closes board and returns to Monitor tabs.
- Personal board: kanban + list view both working; correct task count; Add task works.
- Escape at workspace level (no board open): correctly navigates home.
- Mobile (390x844): list view renders; sidebar slides in behind board via `<` button; class workspace loads with all 6 tabs accessible.
- No "Something went wrong" or "Failed to load" errors anywhere in the sweep.
- "—" (em-dash) used as null-value placeholder in ListView and AnalyticsPanel (e.g. empty deadline, no cycle time). These are typographic null indicators, not sentence connectors -- accepted as-is.

### 2026-07-01 (full codebase audit + mobile polish + QR join flow)

**Security fixes (from full codebase audit):**
- `boards/[id]` DELETE: TAs could delete class group boards — fixed gate from `!= educator && != ta` to `!= educator` only. Commit `8e70326`.
- `attachments/[id]` DELETE: any board member could delete another user's file — now checks `uploadedBy === session.userId OR member.role === "owner"`. Same commit.

**QR / join flow (invited students):**
- Login page defaults to signup mode when `?next=/class/join/` is in URL — first-time students scanning QR no longer see "Sign in" first. Commit `24516cc`.
- Pre-verified (CSV-imported) students who sign up via QR link get `?auto=1` appended to the join redirect — auto-join fires on landing, no "Join class" click needed. Commit `42ea497`.

**Mobile polish:**
- Board header inside class workspace: replaced cramped "kanbedu / CS301... / Gro... Back" breadcrumb with a clean `← CS301 — Software Engineering` back button on mobile (desktop keeps full breadcrumb). Commit `4aab138`.
- Tab bar: added left-fade gradient that appears when scrolled right, widened right fade from 32px to 48px. Tab bar scroll is bidirectional-hinted now. Same commit.

**Known decisions added:**
- Student's class board URL pattern is `/?class=[classId]` (home page with query param), NOT `/class/[classId]` (that's the educator panel). Don't confuse the two routes.

### 2026-06-30 (TA permissions + CSV cap + invite email verification bypass)
- TA group delete restricted to educator-only: `DELETE /api/classes/[id]/groups` now calls `requireOwnerEducator` (educator only, not TA). TAs get 403.
- RosterPanel delete button hidden for TAs: added `role: "educator" | "ta"` prop to RosterPanel; `canDeleteGroup = interactive && role === "educator"`. ClassWorkspace passes `role` down.
- CSV invite email cap raised from 50 to 100: `MAX_INVITE_EMAILS` in `import/route.ts` now matches `MAX_ROSTER_ROWS`. A full 100-student import sends all invites in one shot. UI message updated to match.
- Invited students bypass email verification on join: `POST /api/classes/join/[code]` now checks roster entry BEFORE the `emailVerified` gate. If the user's email matches a `ClassRosterEntry` for this class, they skip verification (the invite email already proved they own the address) and their account is auto-verified (`emailVerified: true`) inside the join transaction. Students joining via public code (no roster entry) still require verification.
- Signup auto-verifies if email is in any ClassRosterEntry: added roster check in parallel with uniqueness checks. If match found, `emailVerified: true` at account creation, skips verification email, login page reads `data.emailVerified` and skips `/check-email` screen.
- `/api/auth/handle-check` restored to PUBLIC_PATHS in proxy.ts (was accidentally dropped in CSP refactor — broke all new signups). Commit `7443615`.

### 2026-06-29 (full QA sweep + 10 bug fixes)
- CSRF bypass closed: narrowed PUBLIC_PATHS in proxy.ts so logout / password-change / account-delete go through CSRF check (were skipped under blanket `/api/auth/` rule)
- Unverified accounts blocked from password change: `getSession` -> `getVerifiedSession` in `src/app/api/auth/password/route.ts`
- Soft-deleted task data leak fixed: `GET /api/tasks/[id]` now filters `deletedAt: null` on the auth-lookup query, so deleted tasks return 404
- Group reorder made sequential: was concurrent batch (`$transaction([array])`), now `$transaction(async tx => { for...of })` per CLAUDE.md
- Group rename made atomic: `Group.name` + `Board.name` updated in a single transaction (were two separate writes)
- Archived-class guard added to `POST /api/classes/[id]/roster` (resend-invite); DELETE already had it
- DndContext id added to RosterPanel (`id="roster-dnd"`) per CLAUDE.md SSR hydration requirement
- TaskModal upload error cleared per-file (was cleared once before the loop, so error from file N persisted to file N+1)
- Schema: added `onDelete: Cascade` to `Column.board`, `TaskActivity.user`, `TaskDescriptionVersion.user`, `BugReport.user`, `Attachment.uploader` -- prevents FK crashes on board/user deletion
- Migration `20260629000000_fix_cascade_deletes` applied to local Postgres + Neon prod
- k6 load test: 300 concurrent users against Vercel preview -- both thresholds passed
- All fixes committed `8f86497` and pushed to dev

### 2026-06-28 (GCS live + soft-delete + pricing + attachment limit)
- GCS migration shipped to prod (`b0f4ba7`): attachments now go to bucket "kanbedu" (asia-southeast1). Signed V4 URLs (1h expiry). Legacy Vercel Blob URLs pass through unchanged.
- Task soft-delete + trash panel + restore (`bcab94a`, `21168b1`, `75a835e`): deletedAt/deletedBy on Task, trash list endpoint with 30-day lazy purge, restore endpoint (permission-aware), TrashPanel UI in TaskModal.
- ProWaitlist + public waitlist endpoint (`ca3991a`, `1ebb43b`): new model, POST /api/waitlist (rate-limited 5/IP/hour, idempotent upsert on email).
- Pricing page live (`a4ec40d`, `010218f`, `2cc8d98`, `bba1c22`): Lecturer Pro tier with waitlist form, feature copy finalized, contact email updated to kanbeduapp@gmail.com, /pricing and /api/waitlist added to PUBLIC_PATHS in proxy.ts.
- Board attachment limit raised to 100MB (`3251505`): inline hint "100 MB per board" always visible, inline error popup for oversized files instead of toast (`487ead7`).
- KetiakHitam merge post-fix: resolved 3 bugs -- missing PUBLIC_PATHS entries, Prisma client not regenerated after schema change, migrations not applied to local DB.
- Landing/nav UI polish: divider between "Log in" and "Sign up", button weight + padding tweaks (`fcc3166`, `7b37a2e`).

### 2026-06-27 (visual consistency + GCS prep + git hygiene)
- Fixed dark-mode tooltip hardcoding in ListView.tsx (assignee hover) and TaskModal.tsx (Back/Esc tooltip): `bg-[#1C1917]` → `bg-ink`, `text-white` → `text-paper`. Was invisible in dark mode: `dd8dab1`
- Fixed login page focus ring: `focus:border-border` → `focus:border-ink/30` on all 4 inputs. Now matches every other form in the app: `dd8dab1`
- Added `.claude/worktrees/` to .gitignore. `git add -A` was staging worktrees as git submodules (embedded repos). Fixed with `git rm --cached` + new .gitignore entry: `789c4d6`
- GCS migration planned but not started: waiting for service account JSON key from sponsor "althras". Plan: `src/lib/gcs.ts`, update attachments upload route + signed V4 URL generation (1h expiry), update delete route. Store GCS object path in DB instead of public URL.
- Fixed stale comment in next.config.mjs: `middleware.ts` → `proxy.ts`
- Lesson: never `git add -A`. Always stage specific files by name.

### 2026-06-27 (account deletion + CSP hardening)
- Added `DELETE /api/auth/account`: password-confirmed deletion, full cleanup (board transfer/delete, Vercel Blob, TaskActivity, TaskDescriptionVersion, BugReport, Attachment DB, Task.assigneeId null). Blocks if user owns classes.
- CSP hardened: removed `unsafe-eval` (prod) and `unsafe-inline` from script-src. Moved CSP to `src/proxy.ts` with per-request nonce (`x-nonce` header). Root layout is async, passes nonce to inline theme script via `suppressHydrationWarning`. Dead Supabase connect-src URLs removed.
- Next.js 16 discovery: middleware was renamed from `middleware.ts` to `proxy.ts` and must export `proxy` (not `middleware`). Fixed export name, noted in CLAUDE.md.
- ProfilePanel "Delete account" row live (was "Coming soon"): password-confirm modal, wrong-password error, class-ownership block message.

### 2026-06-27 (attachments live + participation fix + perf)
- Deployed attachments to production: created Vercel Blob store (kanbedu-blob, sin1), added BLOB_READ_WRITE_TOKEN + 3 VAPID push keys to Vercel env, ran `npx prisma migrate deploy` on Neon prod for `20260618222516_add_attachments`
- Web push notifications live in production
- Fixed Participation tab word counts breaking on student name changes: added nullable `userId` FK to Comment model, migration `20260627014343_add_comment_userid` applied to both local + Neon prod. New comments store userId directly; legacy comments fall back to author string matching
- Comment POST route now saves `userId: session.userId` on every new comment
- Per-task attachment limit lowered from 20 to 10: `abd28e1`
- 100MB per-board attachment hard limit added, then immediately lowered to 50MB to fit 20 groups within Vercel Blob 1GB hobby tier: `7c94a48`, `5fcfab0`
- Integrity route performance fix: changed from loading ALL tasks (with include) to OR-filtered select -- only loads done-column tasks (speed run + column skip candidates) + movedByNonAssignee tasks in active columns. Per-board analytics route left unchanged (already efficient): `27a48ae`
- Fixed admin panel Email today widget always hidden when Brevo key absent: shows N/A instead
- Merged KetiakHitam branch (friend's security hardening -- invisible to users): structured security event logging, denial logging on educator/admin routes, upload MIME allowlist, CSP for Blob images, PDPA privacy policy, robots.txt + sitemap, access-control regression tests
- Removed deadline time-of-day feature (was in KetiakHitam, never reached production)
- All changes pushed to both dev and main

### 2026-06-20 (context audit + KetiakHitam merge + fixes)
- Context audit: found attachment code had silently landed in origin/main (not held back as recorded); corrected project_changelog, project_context, data_model, feedback_branch_workflow memory files
- Fixed Email today widget in admin panel always hidden when Brevo stats unavailable -- now shows N/A: `c5e0b2d`
- Merged KetiakHitam branch into dev (friend's security hardening batch -- see 2026-06-20 KetiakHitam section below)
- Removed deadline time-of-day feature (from KetiakHitam) -- never reached production, no DB cleanup needed: `c75d754`
- Committed deletion of OVERNIGHT_LOG.md, OVERNIGHT_LOG_ARCHIVE.md, kanbeduhero.png -- overnight automation permanently off: `73f4042`
- All pushed to origin/dev. origin/main not updated yet.

### 2026-06-20 (KetiakHitam -- friend's batch, merged into dev)
Invisible to users: structured security event logging (`securityLog.ts`), denial logging on all educator/admin routes, board + class realtime secret rotation on member removal, upload MIME type allowlist on attachments (blocks SVG/HTML), CSP updated for Vercel Blob images, PDPA privacy policy update, robots.txt + sitemap (SEO only), accessibility label fixes on login form, access-control regression tests, k6 load test script, removed unused `dateInputToISOString`.

### 2026-06-20 (OG image polish + overnight agent stopped)
- Fixed stuck optimistic activity entries after posting a comment: `f8babb3`
- Reverted column body color tint in KanbanColumn (drop zone stays neutral): `4afa3b0`
- OG image redesign: Geist Bold/Regular fetched from jsDelivr at runtime (no font files in repo), staggered waterfall column layout with exact dark palette colors, tagline "Project boards. Without the noise.": `4afa3b0`
- Dropped `runtime = "edge"` from OG image (Node.js runtime needed for reliable font fetch)
- Updated OG/Twitter title to "Kanbedu - Project boards. Without the noise." and description to user's original copy: `8bf7b3e`
- Overnight cloud agent (trig_01VRfjv2sfDo2PUyqKcNzA3C) disabled + `overnight` branch deleted -- was burning tokens unsupervised
- All pushed to main

### 2026-06-19 (attachments + tests + hiring)
- File/image attachments via Vercel Blob: `Attachment` model, `POST /api/tasks/[id]/attachments`, `DELETE /api/attachments/[id]`, attachments section in TaskModal (between description and comments): `818c67a`
- Migration `20260618222516_add_attachments` applied to local DB -- NOT yet applied to Neon prod (needs `npx prisma migrate deploy` + `BLOB_READ_WRITE_TOKEN` in Vercel before shipping)
- Attachment feature held back on `dev` -- all other commits pushed to main
- 52/52 unit tests pass, 7/9 e2e tests pass (2 board tests skip when no groups -- expected): all clean
- OG preview image initial version added to dev: `fcc466e` (redesigned + shipped to main on 2026-06-20)
- Production deploy: pushed all commits to main except attachments
- Hired Dev 3 (QA testing + feedback/support). Interview tips: live QA session, integrity flag scenario, login lockout scenario. Two-tab test is the key filter.

### 2026-06-19
- Reduced useRealtime `POLL_INTERVAL` from 10s to 3s: `d1cca72`
- Added "Invited, not yet joined" section to RosterPanel with Resend + Remove buttons: `d1cca72`, `70616ca`
- New API routes `POST/DELETE /api/classes/[id]/roster` for pending invite management: `70616ca`
- Added per-email rate limit (3/24h) to password reset: `35fae80`
- Added Brevo daily usage display to AdminPanel: `167e699`
- New `GET /api/admin/email-stats` endpoint: `167e699`
- Added success toast after group deletion showing affected student count: `f3d8058`
- Added 15s background poll + visibility change handler to Monitor, Integrity, Participation panels: `2d89573`
- Backup test script `scripts/test-backup.js` + `test:backup` npm script: `e8958a7`

### 2026-06-18 (participation panel + educator UX fixes)
- Merged overnight agent sessions (5 fixes): column-reorder splice, GroupBoardView key, ListView memo, columnPalette modulo guard, RosterPanel rename key: `178e6b0`-`44a6eae`
- Fixed Escape in TaskModal closing ClassWorkspace: `4bb0ed8`
- Fixed duplicate header + Back buttons when educator opens a group board: `755df48`
- Fixed ClassWorkspace Escape navigating home while a group board is open: `97a01d5`
- Built Participation tab + ParticipationPanel component: `945018f`
- vitest exclude added for `.claude/worktrees/**`: vitest.config.ts
- Pushed dev to main

### 2026-06-18 (automation audit + safeguards)
- settings.local.json: deny rules for force-push, prisma migrate, DROP TABLE: `12c8d54`
- CSV import: email cap 50/import, inviteFailed + inviteCapped surfaced in UI: `12c8d54`
- /api/health endpoint added: `12c8d54`
- ESLint added (0 errors baseline): `12c8d54`
- 7 new import tests: `12c8d54`

### 2026-06-18 (Playwright E2E + shared components)
- Added `@playwright/test` + `playwright.config.ts` + `e2e/critical-path.spec.ts` (8 tests): `2114f5c`
- Extracted 4 shared educator panel components (GroupSearchBar, SortPills, LiveIndicator, GroupCardHeader): `9914125`
- Fixed ClassWorkspace Escape logic (was inverted): `9914125`
- Added 14 groupSearch.spec.ts unit tests: `9914125`
- Standardized "Did you mean" placement + group search across all 3 panels: `a61cf5e`

### 2026-06-18
- CSV import sends invite emails to new students, dedupes re-imports, 100-row hard cap: `facc362`
- View toggle icon alignment fixed: `fc597b6`
- Changelog detail page at `/changelog/reliability-update`: `2937a30`-`8007717`

### 2026-06-17
- Merged overnight branch (8 code fixes): `714c402`
- Fixed class clone demoting co-educators to TA: `839d1ac`
- Standardized deadline display (overdue only after deadline day passes): `839d1ac`
- Fixed bold/italic toolbar mangle: `94504ce`
- Fixed comment flicker on live update: `94504ce`
- Changed underline markdown `__` to `++`: `94504ce`

### 2026-06-16 (overnight -- autonomous)
Overnight Opus sessions fixed: column-delete done-state, failed DnD snap-back, display name debounce race, admin confirm dialog, duplicate description save, dead `getSession` imports, stale docstrings, column rename on shared boards.

### 2026-06-16
- Branch workflow changed: `dev` is now default; push `main` only on explicit release request
- CI gate added: `npx vitest run` on push to dev + main: `6943974`
- Full QA pass -- fixed: sidebar DnD hydration, Monitor/Integrity stale-group-list, view-toggle pill, TaskModal phase colors, Roster dropdown, search bar styling
- "Did you mean X?" group search in Monitor + Integrity: `9fc4710`

### 2026-06-15
Bug sweep: push notification orphans, stale subs, drag broadcast, integrity false-positives, deadline timezone, clone roster

### 2026-06-13
Invite-to-class flow shipped; CSRF replaced; emailVerified enforced; realtime broadcasts awaited

### 2026-06-09
DB query optimization; missing indexes added; Vercel region moved to sin1

### 2026-06-07
Full mobile redesign; 5 security fixes from red team audit; shared Avatar component

### 2026-06-01
Educator features v1 shipped: Classes, Groups, Group Boards, Monitor, Presets, clone-for-next-semester
