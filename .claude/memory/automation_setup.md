---
name: automation-setup
description: "Complete record of the Claude Code automation/config setup. Read this to rebuild everything on a new machine, or to understand why settings behave the way they do."
metadata: 
  node_type: memory
  type: project
  originSessionId: c525ede9-adfa-4655-9b2e-56739460ac9c
---

# Claude Code Automation Setup (recorded 2026-07-04)

Everything needed to rebuild Jorge's Claude Code automation from scratch. If any of this drifts from reality, update this file on the spot.

## The four pieces

### 1. Global settings: `~/.claude/settings.json` (machine-local, NOT in any repo)

This is the single most important file. Full content as of 2026-07-04:

```json
{
  "permissions": {
    "allow": [
      "Bash(node -e ' *)",
      "Bash(curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3099/landing)",
      "Bash(node .qa/test-retry.js)",
      "Bash(npm run *)",
      "Bash(node .qa/login.js)",
      "Bash(netstat -ano)",
      "Bash(awk '{print $5}')",
      "PowerShell(Get-CimInstance Win32_Process -Filter \"ProcessId=18448\")"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(rm -r *)",
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git push --force-with-lease *)",
      "Bash(git branch -D *)",
      "Bash(git push origin --delete *)",
      "Bash(git reset --hard *)",
      "Bash(prisma migrate deploy *)",
      "Bash(prisma db push *)",
      "Bash(npx prisma migrate deploy *)",
      "Bash(npx prisma db push *)",
      "Bash(vercel *)"
    ],
    "defaultMode": "bypassPermissions"
  },
  "model": "sonnet",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "Write-Output '{\"systemMessage\": \"REMINDER: You just committed — update project_changelog.md in memory now (1-2 lines per change, commit hash inline, newest first). See feedback_behavior.md for the format.\"}'",
            "if": "Bash(git commit*)",
            "shell": "powershell"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "Write-Output '{\"systemMessage\": \"REMINDER: Update project_changelog.md in memory with what changed this session (2-3 lines, newest first).\"}'",
            "shell": "powershell"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "Write-Output '{\"systemMessage\": \"REMINDER: Update project_changelog.md in memory before context compacts — flush any unlogged changes now.\"}'",
            "shell": "powershell"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "Set-Content -Path 'C:\\Users\\homin\\Downloads\\Kanbedu\\.claude\\settings.local.json' -Value '{\"permissions\":{\"allow\":[\"PowerShell(*)\",\"Bash(*)\",\"Skill(update-config)\",\"Skill(update-config:*)\"],\"defaultMode\":\"bypassPermissions\"}}' -Encoding utf8",
            "shell": "powershell"
          }
        ]
      }
    ]
  },
  "effortLevel": "xhigh",
  "autoUpdatesChannel": "latest",
  "autoCompactEnabled": true,
  "inputNeededNotifEnabled": true,
  "agentPushNotifEnabled": true
}
```

Key behaviors this creates:
- **Permission prompts are OFF globally** (`bypassPermissions`). The deny list still hard-blocks destructive git/prisma/vercel commands.
- **Changelog reminder hooks** fire after every git commit, on session stop, and before context compaction.
- **The SessionStart hook REWRITES `.claude/settings.local.json` in the Kanbedu repo on every session start.** This is why hand-edits to settings.local.json never stick. It is the self-heal mechanism: local settings can never drift.
- Push notifications to phone are on (`agentPushNotifEnabled`, `inputNeededNotifEnabled`).

### 2. Project settings: `Kanbedu/.claude/settings.json` (git-tracked)

Read-only command allowlist (tsc, vitest, health-check curl, prisma generate, lint). A fallback safety net that only matters if bypassPermissions is ever turned off. Committed to the repo, survives anything.

### 3. Memory mirror: `Kanbedu/.claude/memory/` (git-tracked)

Git-tracked copy of the live memory at `~/.claude/projects/c--Users-homin-Downloads-Kanbedu/memory/`. The live copy is what Claude Code reads; the mirror is backup/audit. Sync command (run at end of memory-changing sessions, or let the Stop hook do it if configured):

```bash
cp ~/.claude/projects/c--Users-homin-Downloads-Kanbedu/memory/*.md ".claude/memory/"
```

Then commit the changed mirror files. See `.claude/memory/README.md` in the repo.

### 4. Phone remote control (account-level, nothing to back up)

Working from phone uses Claude Code's remote/mobile access tied to the Anthropic account (hominghao1710@gmail.com). No local files involved. On a new machine: install Claude Code, sign in to the same account, notifications and remote access resume. The only thing to protect is the account itself.

## Also on this machine (gitignored or cloud-side)

- **qa-test skill**: `Kanbedu/.claude/skills/qa-test/SKILL.md` — git-tracked as of 2026-07-04 (was gitignored before).
- **Cloud routines**: none active. The old overnight routine (trig_01VRfjv2sfDo2PUyqKcNzA3C) is permanently disabled; do not re-enable.
- **CI**: GitHub Actions runs `npx vitest run` on push to dev/main (lives in the repo, already durable).

## Rebuild-from-zero checklist (new machine / reinstall)

1. Install Claude Code, sign in to the Anthropic account.
2. Clone the Kanbedu repo (brings project settings, memory mirror, qa-test skill, CLAUDE.md, PLAYBOOK.md).
3. Copy the memory mirror back to live: `cp .claude/memory/*.md ~/.claude/projects/c--Users-homin-Downloads-Kanbedu/memory/`
4. Recreate `~/.claude/settings.json` from the JSON block above (fix the Windows path in the SessionStart hook if the repo lives elsewhere).
5. Done. settings.local.json regenerates itself on first session start.
