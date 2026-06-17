---
name: educator-features
description: How educator features (Classes/Groups/Monitor/Presets/Roster) are built and designed
metadata: 
  node_type: memory
  type: project
  originSessionId: 5f1f00a7-e420-470f-bf08-3242e058de33
---

## Architecture (built 2026-06-01)
- **One account type** — anyone can create a Class (becomes educator) or join as student. No signup-time role choice.
- **Group boards reuse real Boards** — a group's board IS an ordinary `Board`. Students + educator are `BoardMember`s, so tasks/comments/realtime/analytics work unchanged. Privacy is structural: a student is only a BoardMember of their own group's board.
- **Personal boards filter out group boards** via `where: { board: { group: { is: null } } }`.
- **Routing:** `/class/[id]`, `/class/join/[code]` — real routes, not panels, because class has many surfaces and needs shareable URLs.

## Data models
- `Class` → has `ClassMember`s (role: educator|ta|student, nullable `groupId` — null = lobby) and `Group`s
- `Group` → one-to-one with a real `Board` via `boardId`
- `ClassPreset` → JSON `columns` + `tasks` per class, applied to new groups only (never retroactive)
- `ClassRosterEntry` → keyed `@@unique([classId, email])` with `claimedBy` for join status
- `ClassMember.displayName` → educator-set name override; rendered as `displayName ?? user.name` in all class contexts

## Roster import (built as part of v1)
- Educator uploads CSV: `name, email, group (optional)`
- Matching is by email (lowercase/trimmed). On join, matched account gets `displayName` set and roster entry marked `claimedBy`.
- `group` column in CSV can pre-assign students to groups as they join.
- API: `POST /api/classes/[id]/import`
- Hard limit: 100 valid rows per import (returns 400 if exceeded)
- On import, invite emails are sent to **newly added** rows only (re-importing existing emails skips them — no spam)
- Group name matching in import is case-folded; join-flow lookup is exact string match against DB — keep group names consistent case to avoid mismatches.

## Key behaviors
- **Monitor:** per-group progress snapshot (total tasks, done %, stalled 3+ days, overdue). No cross-group ranking by design.
- **Group search "did you mean":** Monitor's and Integrity's "Search groups…" boxes both suggest a numerically-equivalent group name when the search has no literal substring match (e.g. "04" suggests "Group 4"). Shared logic in `src/lib/groupSearch.ts` (`matchesGroupName` / `findGroupSuggestion`). Added 2026-06-16.
- **Integrity flags:** speed-run (<30min complete), column-skip, non-assignee mover — class group boards only.
- **Clone:** copies preset + group structure. Students rejoin the new class (not auto-carried). `copyRoster` pre-fills members sequentially (for...of in tx, not Promise.all). Co-educators keep their `educator` role; only the cloner becomes `ownerId`.
- **Archive:** class becomes read-only. Only educators can archive (not TAs).
- **Board ownership transfer blocked** on class group boards — use class role management instead.
