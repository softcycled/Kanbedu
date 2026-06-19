# Overnight Maintenance Log

Shared memory across unsupervised overnight sessions. Each session works only on
the `overnight` branch (never `dev`/`main`), reads this file first to avoid
repeating work, and appends a dated entry below. Plain English for the founder;
a short technical line sits under each item.

## Rules for this file

- **Read before doing anything.** Check what was already reviewed so you don't repeat it.
- **Write your reasoning.** Before "Fixed" / "Checked and found fine", add a brief
  "What I read" section (file names, what you were looking for). This creates a
  reasoning trail for the founder to audit your work.
- **Cap: keep this file under 150 lines.** When it would exceed that, compress all
  sessions older than the most recent two into a single "Archive" summary at the
  bottom. Move the full text of those old sessions to `OVERNIGHT_LOG_ARCHIVE.md`.
  Never delete — archive. The active log must stay short enough that a fresh context
  window can read it entirely without truncation.
- **Update the baseline** at the top whenever test counts change.

## Baseline (keep up to date)

`npx tsc --noEmit` → clean.
`npx vitest run` → **38 tests passing**, 0 failing (3 files: `markdown.spec.ts`,
`auth.spec.ts`, `import.spec.ts`). Confirmed 2026-06-18 (Session 6).
If a session sees fewer passing, something regressed — do not proceed.

---

## 2026-06-17 — Session 8

Read line-by-line several files earlier passes hadn't dug into: the account/
settings screens (board settings, profile & preferences), the notifications
bell, the create/join-class dialog, the page header, the description diff
viewer, the admin bug-report endpoints, the task-history and database-health
endpoints, the per-board analytics number-crunching, and the colour-palette
helpers. Also ran a focused sweep over the marketing/landing pages, toasts,
and small shared helpers. Most of the app is in good shape after seven prior
passes; found and fixed one genuine reliability gap.

### Fixed

1. **Hardened a shared colour helper so an odd internal state can't crash a
   screen.** A small utility that picks a column's default colour by its
   position could hand back "nothing" if it was ever asked for a colour using
   an invalid position (which happens, for example, when a task's column isn't
   in the currently-loaded list). One screen already worked around this by
   hand; another relied on it never happening. I made the helper itself always
   return a real colour, so no screen can blank out or crash from this. Nothing
   changes for users in normal use — this just removes a hidden trip-wire.
   *Tech: `lib/columnPalette.ts` `getColumnPalette(index)` is typed non-null but
   returned `undefined` for a negative/out-of-range index (`COLUMN_PALETTE[-1]`),
   which would throw on the following `.dot`/`.bg` access. `TaskModal` guarded
   `index < 0` locally; the `Board` drag-overlay did not. Normalised the modulo
   (`((index % n) + n) % n`) and defaulted non-integers to 0. tsc clean, 31/31
   tests. Commit e2494cf.*

### Checked and found fine (no action needed)

- Board settings panel (rename, invite-link, transfer/remove/leave/delete) —
  confirm dialogs close correctly and permission gating is consistent.
- Profile & settings screen, notifications bell (polling + mark-read), the
  create/join-class dialog, the diff viewer, and the admin report PATCH/DELETE
  endpoints all guard their inputs and clean up listeners/timers sensibly.
- The class-integrity and per-board analytics endpoints guard every average
  against divide-by-zero, freeze done-task ages/cycle-times, and keep
  completed + in-progress = total.
- Landing pages, toasts, skeletons, CSV/group-search/avatar/label helpers all
  clean (agent-assisted sweep).

### Recommendations (not implemented — judgment call, ties to existing item)

- **The Analytics screen's "Overdue" number and its "Overdue" task filter use
  two different rules**, so the count card and the filtered list can disagree
  for a task due *today*. This is the same underlying question already flagged
  in Session 3 — does a deadline mean "due at the start of the day" or "due by
  end of day"? The summary count treats a task as overdue only after the whole
  day passes; the table's filter treats it as overdue from midnight. Both should
  use the same rule once that product decision is made.
  *Tech: `api/analytics` summary uses `endOfDay(deadline) < now`;
  `AnalyticsPanel.tsx` line 148 filter uses `new Date(deadline) < now`.*

---

## 2026-06-18 — Session 9

(Ran in parallel with sessions 6–8 on a base branched from the latest `dev`, so
some endpoints already had this session's fixes from `dev`. Renumbered to 9 to
avoid colliding with the concurrent session 6.)

### What I read

Re-read project context + changelog. Then read for real bugs: the educator
number-crunching endpoints (`api/analytics`, `api/classes/[id]/integrity`,
`.../monitor`), the class lifecycle endpoints (`.../clone`, `.../members`,
`.../groups`, `classes/join/[code]`), the core task endpoints (`api/tasks`,
`api/tasks/[id]`, `api/comments`, `api/columns`), the realtime plumbing
(`Board`/`BoardContainer`/`GroupBoardView`, `useRealtime`, `broadcast.ts`,
`send-notifications.ts`), and the educator UI (`RosterPanel`, `MonitorPanel`,
`IntegrityPanel`, `TaskCard`). Cross-checked the name-override/date/CSV/group
helpers.

### Fixed

1. **Renaming a group could silently undo a co-teacher's rename.** In the Roster
   tab, the box you type a group's name into kept showing the *old* name if the
   group was renamed elsewhere while you had the tab open (the roster quietly
   re-checks for new students every 12 seconds, and a co-teacher could rename in
   that window). If you then clicked into that box and clicked away without
   retyping, it pushed the stale old name back — reverting the rename you never
   saw. The box now always shows the group's current name. Same bug class already
   fixed for column renames and for the student-name box right beside it; the
   group-name box had just been missed.
   *Tech: `RosterPanel.tsx` group-name `<input>` was uncontrolled (`defaultValue`,
   no `key`), so it never picked up a changed `g.name` from the background poll;
   on blur it compared its stale value against the fresh prop and re-PATCHed the
   old name. Added `key={g.name}` to remount on remote rename. tsc clean, 38/38
   tests. Commit 44a6eae.*

### Checked and found fine (no action needed)

- Analytics/integrity/monitor math guarded against divide-by-zero and missing
  history; multi-assignee and roster-name overrides applied consistently.
- Class clone preserves educator/TA roles correctly; roster copy resets claimed.
- Members endpoint: TAs can assign/remove but not change roles; owner protected;
  board membership stays in lock-step with group assignment.
- Join-by-code places roster-matched students into their group + grants board
  access in one transaction; archived classes blocked.
- Task PATCH/POST, comments, columns: assignee/tag board-scoping, completedAt
  sync, and the `movedByNonAssignee` integrity flag all correct.

### Notes for a human (not bugs, no change made)

- **Monitor's "stalled" count ignores tasks that never moved**, via a guard that
  compares the column-change timestamp to the creation timestamp. Those are set
  from different clocks on create, so they're effectively never equal — the
  exclusion never fires, so the count is correct today, but the guard is dead
  code. The analytics "stagnant" count uses a different (history-based) rule.
  Worth unifying if the monitor count ever looks off.
- **CSV import parser splits on every newline**, so a quoted roster field with a
  literal newline would break into two rows. Essentially never happens for
  name/email rosters; left as-is (matches Session 4's assessment).

---

## Archive

Full text of Sessions 1–7 moved to `OVERNIGHT_LOG_ARCHIVE.md` to keep this file
short. What those sessions fixed (all merged): column-delete done-state, failed
drag-and-drop snap-back, display-name save race, admin confirm-dialog placement,
duplicate description save on modal close, ~30 dead `getSession` imports, two
stale docstrings, column rename stale-value, sidebar class-reorder hiding other
sections, student wrong-board on class switch, orphaned `SupportModal` removed,
List-view phase-pill not refreshing on column rename.

Still-open recommendations from archived sessions (need a human decision, all
auth/email-adjacent so left untouched overnight):
- **Login lockout counts the first failed attempt twice** (`lib/rateLimit.ts`
  ignores its check-only flag when no record exists) — locks after 4 not 5.
- **"Verification email sent!" shows even when the resend failed**
  (`EmailVerificationBanner.tsx` sets `sent=true` without checking `res.ok`).
- **Analytics "Overdue" count vs filter disagree for a task due today** — same
  deadline-meaning product question flagged across several sessions.
