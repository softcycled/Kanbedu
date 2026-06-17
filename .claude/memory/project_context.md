---
name: project-context
description: "What Kanbedu is, who it's for, launch status, profit model, and deployment state"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f1f00a7-e420-470f-bf08-3242e058de33
---

## What it is
Educator-first Kanban for students and teachers. Simplicity is the core value — not competing with Linear/ClickUp. Target: students + lecturers using Kanban for the first time.

**Core differentiator:** Educator features (Classes, Groups, Monitor, Presets). This is THE selling point, not a nice-to-have.

## Who uses it
- Built at request of "W", course coordinator for Foundation in Computing — real user who shaped the product throughout development
- W plans to train all lecturers under his course to use Kanbedu (5-10 educators from day one within his department)
- Another lecturer already promoting via word of mouth
- Distribution problem largely solved via W as multiplier

## Launch status (as of 2026-06-16)
- **Deployed on Vercel.** Auto-deploys on push to main.
- **DB:** Neon (PostgreSQL 16, AWS ap-southeast-1). Migrated from Supabase 2026-06-12. All migrations applied.
- **Priority:** stability and polish trump new features. Ship → get users → stabilize → monetize later.
- **Realtime:** falls back to 10s polling (Supabase vars removed). Needs proper replacement (SSE) eventually — low priority.

## Profit model
- Free for everyone at launch (educators + students)
- **Educator Pro** ($5/month) planned for later: deadline reminders, Calendar export, monitor CSV export for grading, semester summary reports
- Per-educator pricing, never per-class. One paid tier until real user feedback justifies more.
- Goal: self-sustaining (covers hosting + AI token costs), not profit-first

## Out of scope — do not suggest
- Subtasks/checklists, global task search, calendar/timeline view, task dependencies, group chat
- New features generally — stability and polish are the priority right now

## Audit history
- **May 2026:** Full logic/stability audit — 13 bugs fixed across 7 files (mirror states, stale closures, dead code, memo issues)
- **June 2026 (security sweep):** CSRF fix, group board protection, completedAt correctness, clone tx fix, notification orphans, tag P2002
- **June 2026 (full codebase audit):** loading-flag race in useBoardResources, push subscription cleanup widened to all terminal error codes, task title char limit unified to 200 everywhere (was 100 on create, 200 on edit — inconsistent), dead useCallback dependency removed

## Known limitations (found in audit, intentionally not changed — product/policy calls, not bugs)
- **TAs can permanently delete a group's entire board** (all tasks/history) with one click — no archive/confirm step. Same destructive power as educators. Flag if this becomes a real incident; fix would be restricting group delete to educator-only or adding a confirm step.
- **Login lockout is email-keyed, not IP+email** — someone who knows a teacher's email can lock them out of their own account by repeatedly entering wrong passwords. Standard trade-off, would need CAPTCHA to fully close.
- **Integrity flags (speed-run, column-skip) can false-positive** on old tasks whose column history fell outside the 90-day analytics window, or on seeded/imported data. Not dangerous, just noisy — worth knowing if a teacher questions a flag.
- **Notification push tag collisions** — two comments on the same task in quick succession only show the latest push notification (OS replaces same-tag alerts). In-app notification list still shows both; only the push alert is lossy.
- **Analytics/integrity queries are unbounded** — load all tasks + column history for a class into memory rather than aggregating in SQL. Fine at current scale, would need revisiting if a class gets very large (hundreds of students, thousands of tasks).
- **Default column accent colors are positional, not per-column identity.** `resolveColumnPalette(color, columnIndex)` falls back to an index-based palette when no explicit color is set, so deleting/adding/reordering a column reshuffles the colors of every column after it. Only columns with an explicit "Change color" override are stable. Found during 2026-06-16 QA pass, left as-is — would need a design call on whether color should be a stored per-column attribute instead.
- **TA role is backend-only, not reachable from the UI.** Permissions for `ta` exist throughout the API (import, monitor, members, preset, integrity, archive, group delete), but `RosterPanel.tsx` only has a "demote TA → student" button — no "promote student → TA" button exists anywhere. Lecturers currently cannot create a TA through the app at all. Not a bug (nothing crashes), just a dormant feature. User decided (2026-06-16) to leave as-is rather than add a promote button or rip TA out.
