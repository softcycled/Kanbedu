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

## Team (as of 2026-06-19)
- User (founder/lead dev) -- product decisions, architecture, main development
- Dev 2 -- role unclear, hired earlier
- Dev 3 -- just hired, focus: QA testing + future feedback/support tickets

**Why:** User is burnt out and near the finish line. New hires are meant to take load off stability and support so user can focus on higher-level work.

## Who uses it
- Built at request of "W", course coordinator for Foundation in Computing — real user who shaped the product throughout development
- W plans to train all lecturers under his course to use Kanbedu (5-10 educators from day one within his department)
- Another lecturer already promoting via word of mouth
- Distribution problem largely solved via W as multiplier

## Current status (as of 2026-07-02)
Launch-ready for real classroom use with 50+ students. Full codebase audit done (2026-07-01), two security bugs fixed. QR join flow optimised for CSV-imported students -- scan QR → signup → auto-join → land on board in 3 steps with no friction. Mobile tested on 390px (iPhone 14 Pro): board and all educator panels look good. Landing page mobile nav polished (full-screen hamburger menu, Pricing + Log in links work). IP-keyed rate limits raised for shared campus networks. Key Brevo constraint: 300 emails/day free tier -- importing two full 100-student classes in one day risks hitting cap.

## Launch status (as of 2026-06-16)
- **Deployed on Vercel.** Auto-deploys on push to main.
- **DB:** Neon (PostgreSQL 16, AWS ap-southeast-1). Migrated from Supabase 2026-06-12. All migrations applied.
- **Priority:** stability and polish trump new features. Ship → get users → stabilize → monetize later.
- **Realtime:** Supabase removed. Student boards poll every 3s; educator panels (Monitor/Integrity/Participation) poll every 15s. SSE would be cleaner eventually but not a priority.

## Profit model
- Free for everyone at launch (educators + students)
- **Lecturer Pro** coming soon: up to 10 active classes, unlimited archived classes, early access to new features. Waitlist live at `/pricing`. Email capture via ProWaitlist table.
- Pricing direction (2026-07-03): per-semester billing (~RM79/semester, ~15 weeks) favored over monthly after Jorge polled his two engineers -- avoids billing through semester breaks. Not final, but the working assumption. RM50/month was rejected as too steep earlier the same day.
- Next step decided by Jorge (2026-07-03): marketing/promotion and scaling adoption, not billing build.
- Per-educator pricing, never per-class. One paid tier until real user feedback justifies more.
- Goal updated 2026-07-03: user now targets real revenue (see user_profile: RM10k/month across ventures before age 22), superseding the old "just cover hosting costs" framing. Stripe (has Malaysia entity, supports FPX) preferred over Paddle. No billing build yet -- decision is to validate demand first; waitlist had 0 signups as of 2026-07-03 (pricing page has no traffic; not a demand signal either way).
- Payment provider prerequisite: Jorge needs a personal bank account first (has only Touch 'n Go eWallet).

## Production usage snapshot (2026-07-03, pre-semester)
83 users (3 educators, 65 students), 5 active classes, 16 groups, 86 tasks. All users joined within the prior 30 days. Educator count expected to grow to 8-9 when semester starts (W training lecturers in his department). Low July activity is semester-break timing, not churn.

## Infrastructure in use (verified 2026-06-28)
- **Vercel** -- prod deploys on push to main, preview deploys on dev
- **Neon PostgreSQL** (ap-southeast-1) -- production DB
- **Brevo** -- transactional email (300/day free tier, admin panel shows live usage)
- **Google Cloud Storage** -- file attachments, bucket "kanbedu" (asia-southeast1, sponsored by "althras"). Signed V4 URLs (1h expiry). Replaced Vercel Blob as of `b0f4ba7`. Legacy Vercel Blob URLs still served unchanged (passthrough).
- **Sentry** -- error monitoring (@sentry/nextjs installed, NEXT_PUBLIC_SENTRY_DSN in .env)
- **Discord webhook** -- bug reports from the in-app support form go to a Discord channel (NOT Discord OAuth -- OAuth secrets exist in .env but no auth routes are wired)
- **Web Push (VAPID)** -- in-app + push notifications on ASSIGNED and COMMENT events

## Out of scope — do not suggest
- Subtasks/checklists, global task search, calendar/timeline view, task dependencies, group chat
- New features generally -- stability and polish are the priority right now

## Audit history
- **May 2026:** Full logic/stability audit — 13 bugs fixed across 7 files (mirror states, stale closures, dead code, memo issues)
- **June 2026 (security sweep):** CSRF fix, group board protection, completedAt correctness, clone tx fix, notification orphans, tag P2002
- **June 2026 (full codebase audit):** loading-flag race in useBoardResources, push subscription cleanup widened to all terminal error codes, task title char limit unified to 200 everywhere (was 100 on create, 200 on edit — inconsistent), dead useCallback dependency removed

## What's live in production (as of 2026-07-02)
All 6 educator panels: Monitor, Integrity, Participation, Roster, Preset, Settings. Personal boards. Invite-to-class flow. CSV import (100 students max, sends invite emails). Push notifications. OG preview image. Changelog page at `/changelog/reliability-update`. Undo for task/column/group deletion. Pending invite management (Resend/Remove). Brevo usage display in admin. File attachments via GCS (100MB per board, 10MB per file, 10 per task). Task soft-delete + trash panel + restore. Pricing page + Lecturer Pro waitlist capture (`/pricing` is public). Contact email: kanbeduapp@gmail.com. QR join flow with auto-verify + auto-join for CSV-imported students. Mobile-optimised educator panels + board. Mobile landing nav with hamburger menu (full-screen overlay, Pricing + Log in links). Description history recorded only on blur/close (not every auto-save tick).

## Known limitations (found in audit, intentionally not changed — product/policy calls, not bugs)
- **TA group delete is now educator-only** (fixed 2026-06-30): `DELETE /api/classes/[id]/groups` requires educator role; TAs get 403. The delete button in RosterPanel is also hidden for TAs via the `role` prop.
- **Login lockout is email-keyed, not IP+email** — someone who knows a teacher's email can lock them out of their own account by repeatedly entering wrong passwords. Standard trade-off, would need CAPTCHA to fully close.
- **Integrity flags (speed-run, column-skip) can false-positive** on old tasks whose column history fell outside the 90-day analytics window, or on seeded/imported data. Not dangerous, just noisy — worth knowing if a teacher questions a flag.
- **Notification push tag collisions** — two comments on the same task in quick succession only show the latest push notification (OS replaces same-tag alerts). In-app notification list still shows both; only the push alert is lossy.
- **Analytics/integrity queries are unbounded** — load all tasks + column history for a class into memory rather than aggregating in SQL. Fine at current scale, would need revisiting if a class gets very large (hundreds of students, thousands of tasks).
- **Default column accent colors are positional, not per-column identity.** `resolveColumnPalette(color, columnIndex)` falls back to an index-based palette when no explicit color is set, so deleting/adding/reordering a column reshuffles the colors of every column after it. Only columns with an explicit "Change color" override are stable. Found during 2026-06-16 QA pass, left as-is — would need a design call on whether color should be a stored per-column attribute instead.
- **TA role is backend-only, not reachable from the UI.** Permissions for `ta` exist throughout the API (import, monitor, members, preset, integrity, archive) but NOT group delete (that is educator-only as of 2026-06-30). `RosterPanel.tsx` only has a "demote TA → student" button — no "promote student → TA" button exists. Lecturers cannot create a TA through the app at all. Not a bug, just dormant. User decided (2026-06-16) to leave as-is.
