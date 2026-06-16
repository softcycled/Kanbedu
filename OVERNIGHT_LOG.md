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
