# Overnight Maintenance Log

Shared memory across unsupervised overnight sessions. Each session works only on
the `overnight` branch (never `dev`/`main`), reads this file first to avoid
repeating work, and appends a dated entry below. Plain English for the founder;
a short technical line sits under each item.

**Baseline (record for future sessions):** `npx tsc --noEmit` passes clean.
`npx vitest run` → 31 tests passing, 0 failing (2 files: `markdown.spec.ts`,
`auth.spec.ts`). Note: the previously-documented 10 failing auth tests appear to
have already been fixed on `dev` — the auth mock now passes. Keep this 31/0 as
the bar; if a session sees fewer passing, something regressed.

---

## 2026-06-16 — Session 1

Explored: pure-logic lib files, all API routes (agent sweep), React components &
hooks (agent sweep). Fixed five real bugs. Areas not yet deeply reviewed:
realtime/push-notification hooks, the class/group educator views, email/auth
libs, and the analytics computations — good targets for the next session.

### Fixed

1. **Deleting a column could leave its tasks stuck as "not done."** When you
   delete a column and choose to move its tasks into the "Done" column, those
   tasks were moved visually but never actually marked complete — so progress
   bars, analytics, and completion stats would quietly undercount them. Now they
   are marked done (and the reverse case still un-marks them), matching what
   happens everywhere else.
   *Tech: `api/columns/[id]` DELETE only handled clearing `completedAt`, not setting it. Commit 9e52889.*

2. **A failed drag-and-drop of a card didn't snap back.** If the server rejected
   moving a card to another column (e.g. a permissions or network hiccup), the
   card stayed in the new column on screen even though the move didn't save — so
   what you saw no longer matched reality. It now returns to its original
   column on failure.
   *Tech: `Board.tsx` revert read the task's column after the optimistic dragOver had already rewritten it; now captures origin in a ref at drag start. Commit 00bfacd.*

3. **Saving your display name too quickly could save the old name.** If you
   typed a new name and hit Save (or Enter) within a fraction of a second, the
   panel could save your previous name while showing the new one. Saving now
   always uses what's currently in the box.
   *Tech: `ProfilePanel.tsx` NameInput debounced lifting state to the parent by 300ms; made it a directly controlled input. Commit f1aef82.*

4. **Admin "delete report" confirmation was broken.** The confirmation popup was
   accidentally placed inside a dropdown menu in the admin dashboard, which is
   invalid and meant the delete-confirmation could fail to show correctly. Moved
   it out so the confirm dialog works properly.
   *Tech: `AdminPanel.tsx` rendered `<ConfirmModal>` between `<option>`s inside a `<select>`, and once per report; now a single modal at component root. Commit 97555a7.*

5. **Editing a task and closing it saved the same change twice.** Opening a task,
   editing the description, then closing re-sent the already-saved change — which
   created duplicate entries in the task's edit history and extra "updated the
   description" log lines. Now it only saves what actually changed.
   *Tech: `TaskModal.tsx` never refreshed its "original values" baseline after autosave, so flush-on-close re-PATCHed; baseline now updates on successful save. Commit d02fd74.*

### Recommendations (not implemented — need a human decision)

- **Cloning a class with "copy roster" mishandles co-teacher/TA roles.** When an
  educator clones a class and copies the roster, other educators get silently
  demoted to TA (with no board access) and TAs get treated like regular
  students. This touches who-can-do-what (permissions), so it was left alone.
  Worth deciding the intended behavior and fixing carefully.
  *Tech: `api/classes/[id]/clone` role mapping, ~lines 82-104.*

- **A just-posted comment can briefly flicker/disappear** if the board receives a
  live update for that same task right after you post. Low impact and timing-
  dependent; the fix needs care around realtime reconciliation, so flagged
  rather than rushed overnight.
  *Tech: `TaskModal.tsx` ~lines 243-252 reconcile comments by comparing only the last id.*

- **Plain text containing double underscores renders as underlined** in
  descriptions/comments (e.g. `__main__` shows underlined). Whether to change
  markdown handling here is a formatting judgment call, so left for a human.
  *Tech: `MarkdownText.tsx` `__...__` underline rule.*

---

## 2026-06-16 — Session 2

Reviewed the areas Session 1 left for later: the notification/realtime plumbing
(push notifications, live board refresh), the analytics number-crunching, the
class/educator screens, the bug-report/admin endpoints, and the shared
date/time and CSV helpers. Read the actual code rather than guessing, and
double-checked several suspected problems — most turned out to be already
handled correctly, so no change was needed for them.

### Fixed

1. **Tidied up leftover dead code across the server endpoints.** About 30 of the
   app's backend files were importing an old, no-longer-used helper that was
   replaced a while ago by a newer one. Nothing was broken for users — this is
   pure housekeeping that makes the code less confusing for whoever works on it
   next. No behaviour changed; type-check and the full test suite still pass.
   *Tech: removed unused `getSession` imports (codebase migrated to `getVerifiedSession`) from 30 API route files. tsc clean, 31/31 tests. Commit ce3072c.*

### Checked and found fine (no action needed)

- Push-notification sign-up/teardown, the live-update hook, and the service
  worker all handle missing config and dropped connections gracefully.
- The analytics dashboard's percentages and durations are guarded against
  divide-by-zero / missing-data, so they won't show "NaN" or crash.
- The task list's row-rendering optimisation does correctly refresh when a
  task's assignees change (an earlier suspicion was a false alarm).
- Comment notifications reach all assignees (the assignee list is always kept
  in sync when a task is created), so no one is silently missed.

No further safe issues found this pass. Areas still worth a future look: the two
largest files (`TaskModal.tsx`, `Board.tsx`) in depth, and the class clone/import
flows flagged in Session 1's recommendations.

---

## 2026-06-16 — Session 3

Reviewed the roster CSV-import and class-join flows end to end, the core task
create/update/delete API, the board/list views and filter bar, the
notification bell, toasts, and the shared date/deadline helpers. Read the real
code and traced data through it. Most of the app is in good shape after the
first two sessions; this pass found two stale-comment issues (fixed) and one
genuine display inconsistency (left as a recommendation because it's a
judgment call about what "overdue" should mean).

### Fixed

1. **Corrected two out-of-date code comments that described behaviour the app
   no longer does.** Nothing was broken for users — these are notes inside the
   code that had drifted from what the code actually does, which can mislead
   whoever edits these areas next. One described the roster-import step as
   enrolling students and sorting them into groups on the spot (it doesn't —
   that happens later, when each student joins with the class link); the other
   said joining a class always drops you in the "lobby" with no group (in fact,
   if your email was on the imported roster with a group, you're placed straight
   into that group). Also removed one unused line of code in the import handler.
   No behaviour changed; type-check clean and 31/31 tests pass.
   *Tech: `api/classes/[id]/import` header docstring + dead `groupId` (commit d4ce4cc); `api/classes/join/[code]` POST docstring (commit 0b12fa1).*

### Recommendations (not implemented — need a human decision)

- **A task due "today" shows up as "Overdue" on its card and in the side panel.**
  Deadlines are saved as the start (midnight) of the chosen day, and the card's
  deadline label treats anything past that instant as overdue — so from about
  12:01am on the due date, a task due *that same day* already reads "Overdue by
  Xh" in red. Meanwhile the small "Overdue" pill at the top of the task panel
  uses a different rule (a task isn't overdue until the whole day has passed),
  so the same open task can show contradictory signals. The two need to agree;
  the open question is whether a deadline means "due at the start of the day" or
  "due by end of day", which is a product call — hence flagged, not changed.
  *Tech: `lib/utils.ts` — `formatDeadlineLabel` uses `diffMs < 0`; `isOverdue` uses date-only comparison. Both used together in `TaskModal.tsx` (lines 853/855) and on `TaskCard`/`ListView`.*

---

## 2026-06-17 — Session 4

Explored areas the earlier sessions hadn't dug into: the tag/comment/invite
endpoints, the analytics and academic-integrity number-crunching, the CSV and
group-search helpers, the board-resources data hook, the add-task and
column-header widgets, the create/join-board dialog and invite-link parsing,
the notifications endpoint, and the formatting toolbar. Read the real code and
traced it. Most of it is solid after three prior passes; found and fixed one
genuine bug.

### Fixed

1. **Renaming a column could silently undo a teammate's rename.** On a shared
   board, if someone else renamed a column while you had the board open, then
   you clicked that column's title to rename it, the little edit box still
   showed the *old* name (it hadn't caught up to the live change). Pressing
   Enter without retyping would then push that stale name back to the server —
   quietly reverting your teammate's rename. The edit box now always opens
   showing the column's current name, so this can't happen.
   *Tech: `ColumnHeader.tsx` seeded `editValue` from the `label` prop only on mount; since the column component is keyed by id it isn't remounted on a realtime label change, leaving `editValue` stale. Added an effect to resync `editValue` to `label` whenever not actively editing. tsc clean, 31/31 tests. Commit 8152d87.*

### Checked and found fine (no action needed)

- Tag, comment, and invite endpoints: membership checks, expiry handling, and
  duplicate-name handling all look correct.
- Analytics and integrity stats are guarded against divide-by-zero and missing
  history; completion counts always add up.
- The CSV parser, group-name search, board-resource caching hook, and the
  paste-an-invite-link parsing all handle their edge cases sensibly.

### Recommendations (not implemented — judgment call)

- **The formatting toolbar's on/off toggle can mangle nested styles.** Because
  bold is `**` and italic is `*`, selecting already-bold text and clicking
  *Italic* strips one star from each side (turning bold into italic) instead of
  adding italic. Low impact, but the "right" behavior is a design choice, so
  left as a flag.
  *Tech: `MarkdownToolbar.tsx` `wrap()` — the "already wrapped" check uses `endsWith/startsWith(marker)`, so `*` matches inside `**`.*

---

## 2026-06-17 — Session 5

Looked at areas the earlier passes hadn't read line-by-line: the big single-task
backend endpoint (view/edit/delete a task), the comments, notifications, invite,
bug-report, and description-history endpoints, the search/filter bar, the list
view, the educator monitor screen, and the shared date/deadline helpers. Read
the actual code and traced it through; also double-checked a handful of
suspected problems flagged during the sweep, and every one turned out to be
already handled correctly.

### Checked and found fine (no action needed)

- The task view/edit/delete endpoint correctly checks board membership, keeps
  the "done" date in sync when a card moves columns, validates assignees/tags
  belong to the board, and notifies newly-added assignees without double-pinging
  people already on the task.
- The search/filter bar cleans up its keyboard/click listeners properly (no
  leak) and the "Clear" button resets both the search box and the results.
- The list view's row-rendering shortcut does refresh avatars when a task's
  assignees change (an earlier suspicion was a false alarm).
- The educator monitor screen reloads the right class's data on live updates.
- Comments, notifications, invites, the bug-report form, and the description
  edit-history endpoint all guard their inputs and permissions sensibly.

No further safe issues found this pass. Still-open items remain the judgment
calls already flagged in earlier sessions (the "due today shows as Overdue"
deadline wording, the class-clone roster role mapping, the markdown
bold/italic toggle, and the double-underscore underline) — these need a human
decision and were intentionally left alone.
