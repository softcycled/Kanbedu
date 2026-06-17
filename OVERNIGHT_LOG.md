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

No further safe issues found this pass. Open items were the judgment calls from
earlier sessions (all since resolved on dev — see project changelog).

---

## 2026-06-18 — Session 6

### What I read

Re-read the project context + changelog. Then read, looking for real bugs:
the educator number-crunching endpoints (`api/analytics`, `api/classes/[id]/
integrity`, `.../monitor`), the class lifecycle endpoints (`.../clone`,
`.../members`, `.../groups`, `classes/join/[code]`), the core task endpoints
(`api/tasks`, `api/tasks/[id]`, `api/comments`, `api/columns`), the realtime
plumbing (`Board`/`BoardContainer`/`GroupBoardView` reconciliation, `useRealtime`,
`broadcast.ts`, `send-notifications.ts`), and the educator UI components
(`RosterPanel`, `MonitorPanel`, `IntegrityPanel`, `TaskCard`). Cross-checked the
date/name-override helpers (`lib/utils.ts`, `lib/classNames.ts`, `lib/csvParser.ts`,
`lib/groupSearch.ts`).

### Fixed

1. **Renaming a group could silently undo a co-teacher's rename.** In the Roster
   tab, the box you type a group's name into kept showing the *old* name if the
   group got renamed elsewhere while you had the tab open (the roster quietly
   re-checks for new students every 12 seconds, and a co-teacher could rename in
   that window). If you then clicked into that box and clicked away without
   retyping, it pushed the stale old name back to the server — reverting the
   rename you never saw. The box now always shows the group's current name. This
   is the same kind of bug already fixed for column renames and for the
   student-name box right next to it; the group-name box had just been missed.
   *Tech: `RosterPanel.tsx` group-name `<input>` was uncontrolled (`defaultValue`,
   no `key`), so it never picked up a changed `g.name` from the background poll;
   on blur it compared its stale value against the fresh prop and re-PATCHed the
   old name. Added `key={g.name}` to remount on remote rename. tsc clean, 38/38
   tests. Commit 44a6eae.*

### Checked and found fine (no action needed)

- Analytics/integrity/monitor math is guarded against divide-by-zero and missing
  history; multi-assignee and roster-name overrides applied consistently.
- Class clone preserves educator/TA roles correctly (older bug fixed on dev).
- Members endpoint: TAs can assign/remove but not change roles; owner protected;
  board membership stays in lock-step with group assignment.
- Join-by-code places roster-matched students into their group + grants board
  access in one transaction; archived classes blocked.
- Task PATCH/POST, comments, columns: assignee/tag board-scoping, completedAt
  sync, and the `movedByNonAssignee` integrity flag all correct.
- Realtime reconciliation consistent across `BoardContainer`/`GroupBoardView`;
  push-notification cleanup removes subs on all terminal status codes.

### Notes for a human (not bugs, no change made)

- **Monitor's "stalled" count ignores tasks that never moved.** The monitor
  excludes a task from "stalled" when its column-change timestamp equals its
  creation timestamp. In practice those two timestamps are set from different
  clocks on create, so they're effectively never equal and the exclusion never
  fires — so the count is currently correct, but the guard is dead code. The
  analytics "stagnant" count uses a different (history-based) rule. Harmless
  today; worth unifying the two definitions if the monitor count ever looks off.
  *Tech: `api/classes/[id]/monitor` `neverMoved` check vs `api/analytics` stagnation.*
- **CSV import parser splits on every newline**, so a quoted roster field
  containing a literal newline would break into two rows. Essentially never
  happens for name/email rosters; left as-is (matches Session 4's assessment).

---

## Archive

Full text of Sessions 1–3 moved to `OVERNIGHT_LOG_ARCHIVE.md` to keep this file
short. Summary of what those sessions fixed (all merged to dev):
column-delete done-state, failed drag-and-drop snap-back, display-name save
race, admin confirm-dialog placement, duplicate description save on modal close,
~30 dead `getSession` imports, two stale docstrings. Recommendations they raised
(class-clone roster roles, comment flicker, `__dunder__` underline, "due today"
overdue wording) were all later resolved on dev — see project changelog.
