---
name: feedback-branch-workflow
description: "Branch workflow rule: work on dev, not main, now that real lecturers are using the live site"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bad65cff-23bd-40e9-91a8-b83a75417ba4
---

Work on the `dev` branch by default, not `main`, starting 2026-06-16.

**Why:** Real lecturers are now actively using the live site (main auto-deploys to production via Vercel). Before this point, all work happened directly on `main` since there were no real users yet — see [[project_changelog]] for the long history of direct-to-main commits. Now that lecturers are testing it, pushing straight to main risks breaking their live session mid-use.

**How to apply:**
- Default to committing and pushing feature/fix work on `dev`.
- Only push to `main` (which auto-deploys) as a deliberate, user-approved release step — don't do it automatically as part of "fix this bug" type requests anymore.
- `dev` and `main` (local and origin, all four refs) are synced as of 2026-06-16, currently at commit `97bf4af`. Going forward, expect `dev` to be ahead of `main` between releases — that's normal now, not a bug to fix. If the user pushes a fix straight to main (like the first-column empty-state fix), remember to sync it back into dev (merge, not rebase, if both branches have diverged with unique commits — check with `git log main..dev` / `git log dev..main` first).
- When the user says "push" without specifying a branch, ask which branch they mean rather than assuming main, given this new workflow.
