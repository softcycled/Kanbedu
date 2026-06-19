---
name: data-model
description: "Key data model facts — important design decisions, non-obvious relations, constraints"
metadata: 
  node_type: memory
  type: project
  originSessionId: 96a83ac3-c244-44c6-a403-d8d68c4aad69
---

**Multi-assignee design:** Task has both `assigneeId` (single, legacy) AND `TaskAssignee` junction (multi, current). First assignee in junction mirrors into `assigneeId`. Always write both when assigning. Read from `TaskAssignee` (flatten with `.assignees.map(a => a.user)`).

**Column `isDone` flag:** Moving a task to a column with `isDone: true` triggers completion logic (sets `completedAt`). Don't add isDone columns without thinking about this.

**Column colors:** Optional enum (blue/orange/green/purple/pink/cyan/yellow/red). `null` = color-by-position (system assigns based on column index). Both modes supported.

**Task ordering:** Float-based `order` field. Compound index `[column, order]` — always include both in board load queries.

**Tags:** Scoped to board, unique by `[boardId, name]`. Many-to-many with Task.

**TaskColumnHistory:** Tracks column movement history. `enteredAt`/`exitedAt` — current column has `exitedAt: null`. Used for cycle time analytics and class integrity checks.

**TaskDescriptionVersion:** Full snapshot on every save. Used for diff viewer. Don't prune.

**Class/Group architecture:**
- `Class` has many `Group`s
- Each `Group` has exactly one `Board` (`boardId` unique FK)
- `ClassMember.groupId = null` means student is in lobby (not yet in a group)
- `ClassMember.displayName` — educator CSV override shown instead of `user.name`
- `ClassPreset` stores JSON (columns + tasks arrays) for cloning — not relational

**Class integrity:** `Task.movedByNonAssignee` flag — set true when someone other than the assignee moves the task. Used for educator monitoring.

**BoardMember roles:** "owner" | "member". Simple two-tier. Owner is the board creator by default.

**Class roles:** "educator" | "ta" | "student". TAs have educator-level write access via `isEducatorOf()`.

**Archived classes:** `Class.archived = true` makes entire class read-only. Check before any mutation.

**RateLimit table:** DB-backed ledger. `identifier` (IP or email) + `route` composite unique. 10% cleanup chance on each hit to prevent unbounded growth.

**Notification vs PushSubscription:** Notification = in-app feed entry. PushSubscription = Web Push endpoint. Both fire on ASSIGNED and COMMENT events but are independent.

**Key indexes to respect:**
- `[column, order]` — always filter by both for board load
- `[boardId, order]` — column ordering
- `[taskId, createdAt]` — activity feed
- `[userId, read]` — unread notification count
