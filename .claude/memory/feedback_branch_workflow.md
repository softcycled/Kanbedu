---
name: feedback-branch-workflow
description: "Branch workflow rule: work on dev, not main, now that real lecturers are using the live site"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bad65cff-23bd-40e9-91a8-b83a75417ba4
---

Work on the `dev` branch by default, not `main`, starting 2026-06-16.

**Why:** Real lecturers are now actively using the live site (main auto-deploys to production via Vercel). Before this point, all work happened directly on `main` since there were no real users yet -- see [[project_changelog]] for the long history of direct-to-main commits. Now that lecturers are testing it, pushing straight to main risks breaking their live session mid-use.

**How to apply:**
- Default to committing and pushing feature/fix work on `dev`.
- Only push to `main` (which auto-deploys) as a deliberate, user-approved release step -- don't do it automatically as part of "fix this bug" type requests anymore.
- `origin/dev` and `origin/main` are synced as of 2026-06-20 at commit `8bf7b3e`. Local `main` may be behind `origin/main` (tracking issue, not a problem). Between releases, expect `dev` to pull ahead of `main` -- that's normal. If a hotfix lands on main directly, merge it back into dev (check divergence first with `git log main..dev` / `git log dev..main`).
- When the user says "push" without specifying a branch, ask which branch they mean rather than assuming main, given this new workflow.
- **Mistake caught 2026-07-03:** made local commits on `dev` and never pushed to `origin/dev`, without saying so out loud. User later found "zero commits on the dev branch on GitHub" and thought something was broken. Per this file's own rule above, pushing to `origin/dev` is the *default* and doesn't need a confirmation ritual -- only `main` does. Don't silently leave commits local; either push to `origin/dev` as part of finishing the task, or explicitly say "committed locally, not pushed yet" in the same turn so it's never a surprise.
