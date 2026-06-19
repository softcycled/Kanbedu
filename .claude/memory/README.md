# Claude Code Memory — Git Mirror

These files are a git-tracked copy of the Claude Code project memory.

The live copy that Claude Code reads lives at:
`~/.claude/projects/c--Users-homin-Downloads-Kanbedu/memory/`

This directory is a mirror so memory changes are version-controlled and survive
machine changes, new contributors, or a Claude Code reinstall.

## Keeping them in sync

At the end of any session that updates memory, run:
```powershell
Copy-Item "$env:USERPROFILE\.claude\projects\c--Users-homin-Downloads-Kanbedu\memory\*.md" ".claude\memory\" -Force
git add .claude/memory/
git commit -m "chore: sync memory snapshot"
```

Or in Bash:
```bash
cp ~/.claude/projects/c--Users-homin-Downloads-Kanbedu/memory/*.md .claude/memory/
git add .claude/memory/
git commit -m "chore: sync memory snapshot"
```

The auto-memory system still reads from `~/.claude/projects/...` — this directory
is for backup and audit trail only, not Claude Code's primary read path.
