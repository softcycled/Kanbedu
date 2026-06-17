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

## 2026-06-17 — Session 4

Explored the tag/comment/invite endpoints, the analytics and academic-integrity
number-crunching, the CSV and group-search helpers, the board-resources data
hook, the add-task and column-header widgets, the create/join-board dialog and
invite-link parsing, the notifications endpoint, and the formatting toolbar.
Found and fixed one genuine bug.

### Fixed

1. **Renaming a column could silently undo a teammate's rename.** On a shared
   board, if someone else renamed a column while you had the board open, then
   you clicked that column's title to rename it, the edit box still showed the
   *old* name. Pressing Enter without retyping pushed that stale name back —
   quietly reverting your teammate's rename. The edit box now always opens with
   the column's current name.
   *Tech: `ColumnHeader.tsx` seeded `editValue` from `label` prop only on mount; added effect to resync when not actively editing. Commit 8152d87.*

### Checked and found fine

- Tag/comment/invite endpoints (membership, expiry, duplicate-name handling).
- Analytics/integrity guarded against divide-by-zero and missing history.
- CSV parser, group-name search, board-resource cache, invite-link parsing.

### Recommendation (judgment call)

- **Formatting toolbar's on/off toggle can mangle nested styles** (bold `**` vs
  italic `*`). (RESOLVED 2026-06-17, commit 94504ce.)

---

## 2026-06-17 — Session 5

Read line-by-line: the single-task backend endpoint (view/edit/delete), the
comments/notifications/invite/bug-report/description-history endpoints, the
search/filter bar, the list view, the educator monitor screen, and the shared
date/deadline helpers. Double-checked several suspected problems — all already
handled correctly.

### Checked and found fine (no action needed)

- Task view/edit/delete endpoint: board-membership checks, keeps the "done" date
  in sync on column moves, validates assignees/tags belong to the board, and
  notifies newly-added assignees without double-pinging existing ones.
- Search/filter bar cleans up its listeners; "Clear" resets search + results.
- List view's row-rendering shortcut refreshes avatars on assignee change.
- Monitor screen reloads the right class's data on live updates.
- Comments, notifications, invites, bug-report, description history all guard
  their inputs and permissions sensibly.

No further safe issues found this pass. Still-open items remain the judgment
calls already flagged in earlier sessions (the "due today shows as Overdue"
deadline wording, the class-clone roster role mapping, the markdown
bold/italic toggle, and the double-underscore underline) — these need a human
decision and were intentionally left alone.

---

## 2026-06-17 — Session 6

Dug into areas the earlier passes hadn't covered line-by-line: the student and
educator class workspace screens (group board wrapper, student view, preset
editor, settings), the sidebar drag-to-reorder behaviour, and a batch of
shared widgets (add-task box, support modal, roster/monitor/integrity panels,
theme provider, avatars). Read the real code and traced the tricky bits
through React's render/effect ordering rather than guessing. Fixed two genuine
bugs and removed one dead file; double-checked two other suspected bugs and
confirmed they are NOT real (details below) so future sessions don't re-chase
them.

### Fixed

1. **Reordering your classes in the sidebar made your other classes disappear.**
   The sidebar groups classes into separate lists (classes you're a student in,
   classes you teach, archived ones). Dragging to reorder one list would wipe
   the *other* lists out of the sidebar until you reloaded the page — they
   weren't deleted, just hidden. Now reordering one list leaves the others
   exactly where they were.
   *Tech: `BoardContainer.handleReorderClasses` rebuilt the whole `classes`
   state from the dragged subset's ids; now splices the reordered subset back
   into their existing slots. tsc clean, 31/31 tests. Commit 178e6b0.*

2. **A student switching between two classes could briefly see the wrong
   class's board.** If a student belonged to two classes (each with its own
   group board) and clicked from one to the other, the board area could keep
   showing the previous class's cards and never refresh to the new one. Now the
   board fully resets when you switch classes.
   *Tech: `StudentClassView` rendered `GroupBoardView` without a `key`, so on a
   board-id change its cache-write effect stamped the old board's tasks into the
   new board's cache and the fetch was then skipped as "fresh". Added
   `key={boardId}` to force a clean remount. (Educator workspace already
   remounts it, so only the student path was affected.) tsc clean, 31/31 tests.
   Commit a05b44f.*

3. **Removed a leftover duplicate support form that nothing used.** There were
   two copies of the "Support & Feedback" feature in the code; only one is
   actually wired into the app (in the Help panel). The unused copy was deleted
   to avoid confusion. Nothing changed for users.
   *Tech: `SupportModal.tsx` had no imports anywhere; the live form lives in
   `HelpPanel.tsx` posting to the same `/api/support`. tsc clean. Commit 512116c.*

### Checked and confirmed NOT bugs (so they aren't re-investigated)

- **Add-task box does not create duplicate cards on Enter.** A suspected
  double-create (Enter saves, the input unmounts, its blur handler fires and
  saves again) does not actually happen: the blur handler that fires on unmount
  is the one from the render where saving was already in progress, so the
  in-flight guard catches it. No change needed.
- **Roster/monitor/integrity panels, theme provider, avatars, preset editor**
  all clean up their timers/listeners and handle their edge cases correctly.

### Recommendations (not implemented — need a human decision)

- **Login lockout can trip one attempt too early, and a "check only" can leave a
  stray record.** The shared rate-limit helper ignores its "don't count this,
  just check" flag when there's no existing record yet: the very first failed
  login for an email gets counted twice, so the account can lock after 4 wrong
  passwords instead of the intended 5. Left alone because it's part of the
  login/security flow, which is off-limits for unattended changes.
  *Tech: `lib/rateLimit.ts` — the no-record/expired-record branch always
  upserts `hits: 1` regardless of the `increment` arg; `api/auth/login`
  calls it with `increment: false` as a pure check. Fix: when `!increment` and
  no valid record exists, return allowed without writing.*

- **"Verification email sent!" shows even when the resend actually failed.** The
  email-verification banner's "Resend email" link reports success without
  checking whether the request worked — so if the server is down or rate-limits
  the request, the user is told the email was sent and waits for one that never
  arrives, with no obvious way to retry. Left as a recommendation because it's
  part of the email-verification (authentication) flow.
  *Tech: `EmailVerificationBanner.tsx` `resend()` sets `sent=true` without
  checking `res.ok`. Fix: only mark sent when `res.ok`; otherwise keep the
  link active (optionally surface a brief error).*

---

## 2026-06-17 — Session 7

Reviewed areas earlier passes hadn't read line-by-line: the boards
create/rename/delete and reorder endpoints, the group create/rename/delete
endpoint, the analytics number-crunching endpoint, the comments and invite
endpoints, the realtime/broadcast plumbing, the shared CSV/preset helpers, and
the board **List view**. Read the real code and traced it. Most of it is solid;
found and fixed one genuine display bug.

### Fixed

1. **In the List view, renaming a column left task rows showing the old column
   name.** When you switch a board to the List layout, each task shows a little
   "phase" pill with its column's name and colour. If that column was renamed —
   by you or by a teammate on a shared board — the pills on the already-listed
   tasks kept showing the *old* name (and colour) until the page was reloaded or
   the list was rebuilt some other way. The board (card) view never had this
   problem; only the List view did. Now the pills update immediately to the
   current column name.
   *Tech: `ListView.tsx` `TaskRow` is memoised and its comparator only checked
   `columnEntry.id`, which is unchanged on a rename/reorder, so the row skipped
   re-rendering. Added `label` and `paletteIdx` to the comparison. tsc clean,
   31/31 tests. Commit eb66d9b.*

### Checked and found fine (no action needed)

- Boards create/rename/delete/reorder and group create/rename/delete endpoints:
  membership/owner checks, archived-class guards, and cascade cleanup all correct.
- The analytics endpoint guards every average against divide-by-zero, freezes
  done-task ages/phase times correctly, and keeps completed + in-progress = total.
- Comments and invite endpoints validate membership, expiry, and verified-email
  state sensibly; comment notifications skip the author and reach all assignees.
- The realtime hook reconnects on timeout and falls back to polling when Supabase
  is unconfigured; the server broadcast helper degrades quietly when keys are absent.
- The board card view (`KanbanColumn`) re-renders correctly on a column rename —
  the List-view bug above did not affect it.

No further safe issues found this pass beyond the one fixed. The still-open
judgment calls from earlier sessions remain (the "due today shows Overdue"
deadline wording, the class-clone roster role mapping, the markdown bold/italic
toggle and double-underscore underline, and the two login/email-verification
flow items in Session 6) — all need a human decision and were left alone.

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

Full text of Sessions 1–3 moved to `OVERNIGHT_LOG_ARCHIVE.md` to keep this file
short. Summary of what those sessions fixed (all merged to dev): column-delete
done-state, failed drag-and-drop snap-back, display-name save race, admin
confirm-dialog placement, duplicate description save on modal close, ~30 dead
`getSession` imports, two stale docstrings. Recommendations they raised
(class-clone roster roles, comment flicker, `__dunder__` underline, "due today"
overdue wording) were all later resolved on dev — see project changelog.
