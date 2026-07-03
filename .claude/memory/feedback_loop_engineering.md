---
name: feedback-loop-engineering
description: "Default work mode -- iterate until the goal is actually achieved, not just coded"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 080b5b20-689a-4e11-8494-f1666e05655d
---

For any non-trivial task, the default workflow is: implement, spin up the dev server, take a screenshot, read it, find what's wrong, fix it, repeat -- until the goal is genuinely met visually and functionally.

**Why:** User doesn't want to babysit with follow-up prompts ("the button is still misaligned", "that broke the mobile layout"). One goal statement should be enough.

**How to apply:**
- After writing code for any UI or feature change, always verify it in a browser before reporting done
- Use the qa-test skill scaffolding (dev server + Playwright screenshots) as the feedback loop
- If something looks wrong in the screenshot, fix it in the same turn without waiting for the user to point it out
- Only report back when the goal is genuinely met -- not just when the code compiles

## Verification depth vs. time cost -- SETTLED 2026-07-03
Default to the fast/light bar: code compiles clean (typecheck), the automatic test suite passes, and a careful read-through of the fix. Do NOT spin up a browser, click through it as a real user, or force failure scenarios (network errors, race conditions) unless the user explicitly asks for that level ("slow way") or the change touches money/auth/data-loss where the cost of being wrong is high enough to default there anyway.

**Why:** a review-fix-verify cycle for the description-history bugs ran to "a little over 12 hours" real time, driven almost entirely by the slow/live verification: two full dev-server kill+cache-clear+restart cycles, a dozen one-off Playwright scripts, multiple debug-log-add/run/remove loops. User confirmed explicitly: "fast way most of the time, then slow way when i ask for it."

**How to apply:** after a fix, default to reporting done once typecheck + tests + read-through are clean. If the user says "test it", "verify it", "make sure it actually works", or similar -- that's the cue to go to the slow way (live browser, forced-failure scenarios). Don't wait to be told the fast way was insufficient; ask if genuinely unsure whether a specific change is money/auth/data-loss-risk enough to warrant slow-way by default.

**Efficiency notes for when live verification IS warranted:**
- If a fix doesn't reproduce as expected on first live test, suspect the test script's own assertions/selectors before assuming the app is broken (happened here: a bad Playwright selector and a false-positive text assertion both cost a full debug cycle).
- Prefer one deliberate round of debug instrumentation (add logs, run once, read everything, remove) over several small trial-and-error script tweaks.
- A stale Fast Refresh/HMR bundle after many rapid edits is a real Windows/Turbopack risk (see CLAUDE.md dev gotchas) -- if a fix doesn't behave as expected after several edits, do one clean restart+cache-clear before spending time debugging the app logic itself, but don't restart repeatedly "just in case."
