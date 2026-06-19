---
name: project-changelog
description: Session log + pending items + settled decisions. Read this first in every new chat.
metadata: 
  node_type: memory
  type: project
  originSessionId: 44280418-cc6b-42da-80d5-fda280a221c5
---

# Kanbedu — Session Log

## Pending / Not Yet Built
- GitHub OAuth and Discord OAuth — secrets in .env but no routes
- Admin panel — health check + bug report viewer only (partial)
- No bulk task operations (move/delete/reassign multiple at once)
- No personal board templates (only class presets)
- No calendar/timeline view (Kanban + list only)
- No activity export
- Comment author is plain string (not FK to User — deletion doesn't cascade). Known, not a bug.
- TA role is backend-only — no UI to promote a student to TA. Dormant feature, intentional for now.
- Realtime falls back to 10s polling — Supabase removed. Needs proper SSE replacement eventually, low priority.
- Integrity panel: search only filters flagged groups — clean groups are invisible. Planned: show all groups regardless of flag status (quick filter toggle).
- Integrity panel: no autocomplete dropdown for group search. Planned: dropdown suggesting group names as you type.

## Known Decisions (do not re-investigate)
- CSRF requires both `csrf-token` cookie and `x-csrf-token` header — manual curl needs both.
- `movedByNonAssignee` flag is class-board-only — ignore it for personal boards.
- Neon HTTP adapter and Prisma Accelerate both tried and reverted (2026-06-09). Don't re-suggest.
- GitHub/Discord OAuth secrets exist but no routes — don't reference as working.
- Default column accent colors are positional (`resolveColumnPalette(color, index)`) — reordering a column shifts unstyled columns' colors. Known, left as-is.
- Analytics/integrity queries load all tasks into memory (not SQL aggregation). Fine at current scale.
- Login lockout is email-keyed, not IP+email. Known trade-off.

---

## Session Log

### 2026-06-18 (automation audit + safeguards)
- settings.local.json: deny rules added for force-push, prisma migrate, DROP TABLE: `12c8d54`
- QA credentials removed from committed skill file → `.env.local` (QA_EMAIL/QA_PASSWORD): `12c8d54`
- CSV import: email cap 50/import, await results, surface inviteFailed + inviteCapped in UI: `12c8d54`
- /api/health endpoint: DB liveness check for UptimeRobot + post-deploy: `12c8d54`
- ESLint added (eslint.config.mjs): 0 errors baseline, 98 warnings: `12c8d54`
- CI: tsc --noEmit + ESLint + overnight branch coverage: `12c8d54`
- 7 new import tests (auth, 100-row cap, invite counts, failure, 50-email cap): `12c8d54`
- Memory files copied to .claude/memory/ for git tracking: `12c8d54`
- OVERNIGHT_LOG: 150-line cap rule, reasoning trail requirement: `12c8d54`
- docs-local/OPS_RUNBOOK.md: rollback, branch protection, Brevo quota, health check steps
- branch protection skipped (requires GitHub Pro for private repos — not worth it yet)
- dev pushed to main (production deploy): `12c8d54`

### 2026-06-18
- CSV import now sends invite emails to newly added students (skips re-imports to avoid spam); hard cap of 100 rows per import: `facc362`
- View toggle icon alignment fixed properly (list lines at y=3.5/7/10.5 matching board squares' visual centers): `fc597b6`
- Changelog detail page at `/changelog/reliability-update` — narrative prose style, no em-dashes: `2937a30`–`8007717`
- Stale markdown test updated for `++` underline syntax: `facc362`
- QA tested CSV import: all 3 scenarios passed (new students, re-import dedup, 101-row limit error)
- `.qa/` added to `.gitignore`: `d139834`
- In-app Reliability Update changelog description updated to include CSV invite feature: `ff14b16`

### 2026-06-17
- Merged overnight branch (5 autonomous Opus sessions, 8 code fixes — see `OVERNIGHT_LOG.md` in repo): `714c402`
- Fixed class clone demoting co-educators to TA — they now keep educator role: `839d1ac`
- Standardized deadline display: overdue only after the deadline day passes; deadline day shows "Due today": `839d1ac`
- Fixed bold/italic toolbar mangle (`*` toggle false-positived against `**`): `94504ce`
- Fixed comment flicker: optimistic comments no longer wiped by arriving live update: `94504ce`
- Underline markdown changed `__` → `++` (dunder names like `__main__` were accidentally underlined): `94504ce`

### 2026-06-16 (overnight — autonomous)
Overnight Opus sessions fixed: column-delete done-state, failed DnD snap-back, display name debounce race, admin confirm dialog placement, duplicate description save on modal close, dead `getSession` imports (~30 files), two stale docstrings, column rename stale-value on shared boards.

### 2026-06-16
- Branch workflow changed: `dev` is now default; push `main` only on explicit release request
- CI gate added: `npx vitest run` runs on push to dev + main; fixed 10 stale mocks first: `6943974`
- Added qa-test project skill: `188ebc8`
- Full QA pass — fixed: sidebar DnD hydration, Monitor/Integrity stale-group-list, view-toggle pill, TaskModal phase colors, Roster dropdown style, search bar styling
- "Did you mean X?" group search suggestion in Monitor + Integrity: `9fc4710`

### 2026-06-15
Bug sweep: push notification orphans, stale subs, drag broadcast, integrity false-positives, deadline timezone, clone roster

### 2026-06-13
Invite-to-class flow shipped; CSRF replaced; emailVerified enforced across API; realtime broadcasts awaited

### 2026-06-09
DB query optimization; missing indexes added; Vercel region moved to sin1

### 2026-06-07
Full mobile redesign; 5 security fixes from red team audit; shared Avatar component

### 2026-06-01
Educator features v1 shipped: Classes, Groups, Group Boards, Monitor, Presets, clone-for-next-semester
