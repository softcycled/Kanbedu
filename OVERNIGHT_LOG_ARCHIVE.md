# Overnight Maintenance Log — Archive

Full text of older overnight sessions, moved here to keep the active
`OVERNIGHT_LOG.md` short enough to read in one context window. Never delete —
archive. See the active log for the running summary.

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
  *Tech: `api/classes/[id]/clone` role mapping, ~lines 82-104.* (RESOLVED 2026-06-17, commit 839d1ac — educators keep role.)

- **A just-posted comment can briefly flicker/disappear** if the board receives a
  live update for that same task right after you post. Low impact and timing-
  dependent; the fix needs care around realtime reconciliation, so flagged
  rather than rushed overnight.
  *Tech: `TaskModal.tsx` ~lines 243-252 reconcile comments by comparing only the last id.* (RESOLVED 2026-06-17, commit 94504ce.)

- **Plain text containing double underscores renders as underlined** in
  descriptions/comments (e.g. `__main__` shows underlined). Whether to change
  markdown handling here is a formatting judgment call, so left for a human.
  *Tech: `MarkdownText.tsx` `__...__` underline rule.* (RESOLVED 2026-06-17, commit 94504ce — switched to `++`.)

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
  (RESOLVED 2026-06-17, commit 839d1ac — deadline display standardized: overdue
  only after the deadline day passes; deadline day shows "Due today".)
  *Tech: `lib/utils.ts` — `formatDeadlineLabel` and `isOverdue`.*

---

## 2026-06-17 — Session 4

Explored the tag/comment/invite endpoints, the analytics and academic-integrity
number-crunching, the CSV and group-search helpers, the board-resources data
hook, the add-task and column-header widgets, the create/join-board dialog and
invite-link parsing, the notifications endpoint, and the formatting toolbar.
Found and fixed one genuine bug.

### Fixed

1. **Renaming a column could silently undo a teammate's rename.** The column
   rename box still showed the old name after a live rename; pressing Enter
   without retyping pushed the stale name back.
   *Tech: `ColumnHeader.tsx` seeded `editValue` from `label` only on mount; added
   resync effect. Commit 8152d87.*

### Checked and found fine

- Tag/comment/invite endpoints; analytics/integrity divide-by-zero guards; CSV
  parser, group-name search, board-resource cache, invite-link parsing.

### Recommendation (RESOLVED 2026-06-17, commit 94504ce)

- Formatting toolbar's bold/italic toggle could mangle nested styles.

---

## 2026-06-17 — Session 5

Read line-by-line the single-task endpoint (view/edit/delete), the
comments/notifications/invite/bug-report/description-history endpoints, the
search/filter bar, the list view, the monitor screen, and the date/deadline
helpers. All double-checked suspicions were already handled correctly.

### Checked and found fine (no action needed)

- Task view/edit/delete: board-membership checks, done-date sync on moves,
  assignee/tag validation, notify newly-added assignees without double-pinging.
- Search/filter bar listener cleanup + Clear reset; list-view avatar refresh;
  monitor live reload; comments/notifications/invites/bug-report/description
  history input + permission guards.

No code changes. Open items were the long-standing judgment calls (since
resolved on dev).

---

## 2026-06-17 — Session 6

Class workspace screens (group board wrapper, student view, preset editor,
settings), sidebar drag-reorder, and shared widgets. Fixed two bugs + removed a
dead file; cleared two false suspicions.

### Fixed

1. **Reordering classes in the sidebar hid your other class sections.**
   *Tech: `BoardContainer.handleReorderClasses` rebuilt the full list from one
   subset; now splices the subset back. Commit 178e6b0.*
2. **A student switching classes could briefly see the wrong board.**
   *Tech: `StudentClassView` rendered `GroupBoardView` without a `key`; the
   cache-write effect poisoned the new board's cache. Added `key={boardId}`.
   Commit a05b44f.*
3. **Removed an orphaned duplicate `SupportModal.tsx`** (live form is in
   `HelpPanel`). Commit 512116c.

### Confirmed NOT bugs

- Add-task box does not double-create on Enter (in-flight guard catches the
  unmount blur). Roster/monitor/integrity/theme/avatar/preset cleanup all fine.

### Recommendations (need a human decision — auth-adjacent, left alone)

- **Login lockout can trip one attempt early.** `lib/rateLimit.ts` ignores its
  "check only" flag when no record exists yet, so the first failed login is
  counted twice (lock after 4 instead of 5). Fix: when `!increment` and no valid
  record, return allowed without writing.
- **"Verification email sent!" shows even when the resend failed.**
  `EmailVerificationBanner.tsx` `resend()` sets `sent=true` without checking
  `res.ok`. Fix: only mark sent when `res.ok`.

---

## 2026-06-17 — Session 7

Boards/group create-rename-delete-reorder endpoints, analytics, comments/invite
endpoints, realtime/broadcast, CSV/preset helpers, and the List view. Found one
display bug.

### Fixed

1. **In List view, renaming a column left task rows showing the old column
   name/colour** (the phase pill). The card view was unaffected.
   *Tech: `ListView.tsx` memoised `TaskRow` comparator only checked
   `columnEntry.id`; added `label` and `paletteIdx`. Commit eb66d9b.*

### Checked and found fine (no action needed)

- Boards/group endpoints (membership/owner/archived guards, cascade cleanup);
  analytics divide-by-zero guards; comments/invite membership+expiry; realtime
  reconnect/poll fallback; card view re-renders correctly on rename.
