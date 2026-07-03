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

**TaskDescriptionVersion:** Full snapshot, written only when the user finishes editing (textarea blur or modal close), NOT on every auto-save tick. The `recordHistory: boolean` field in `updateTaskSchema` controls this -- auto-saves omit it (server defaults to skip), `flushUpdates()` sets it `true`. Used for diff viewer and Participation tab word-contribution counting. Don't prune. Word contribution = positive delta between consecutive snapshot word counts per userId; negative deltas (deletions) are ignored. Zero contribution is expected for tasks whose description was set at creation (not via the edit UI) since no version rows are written at task-create time.

**Comment.author is a string, not a userId.** Participation tab maps author strings back to userIds by matching handle, name, email, and displayName overrides. Comment now also has a nullable `userId` FK (`20260627014343_add_comment_userid` migration applied to both local and prod) -- new comments store userId directly; legacy comments fall back to author string matching. Don't re-investigate the workaround without checking the participation route first.

**Class/Group architecture:**
- `Class` has many `Group`s
- Each `Group` has exactly one `Board` (`boardId` unique FK)
- `ClassMember.groupId = null` means student is in lobby (not yet in a group)
- `ClassMember.displayName` — educator CSV override shown instead of `user.name`
- `ClassPreset` stores JSON (columns + tasks arrays) for cloning — not relational
- `ClassRosterEntry` — CSV import staging table. Fields: id, classId, email (normalized), name, groupName (pre-assigned), claimedBy (userId once joined; null = not yet joined). Unique on `[classId, email]`. Powers the "Invited, not yet joined" section in RosterPanel + Resend/Remove buttons.

**Class integrity:** `Task.movedByNonAssignee` flag — set true when someone other than the assignee moves the task. Used for educator monitoring.

**BoardMember roles:** "owner" | "member". Simple two-tier. Owner is the board creator by default.

**Class roles:** "educator" | "ta" | "student". TAs have educator-level write access via `isEducatorOf()`.

**Archived classes:** `Class.archived = true` makes entire class read-only. Check before any mutation.

**RateLimit table:** DB-backed ledger. `identifier` (IP or email) + `route` composite unique. 10% cleanup chance on each hit to prevent unbounded growth.

**Notification vs PushSubscription:** Notification = in-app feed entry. PushSubscription = Web Push endpoint. Both fire on ASSIGNED and COMMENT events but are independent.

**Attachment model:** Files uploaded via Google Cloud Storage (bucket "kanbedu", asia-southeast1). `url` field stores the GCS object path for new uploads (e.g. `attachments/{taskId}/{timestamp}-{filename}`); legacy Vercel Blob URLs start with `https://` and are passed through unchanged. Signed V4 URLs generated on read (1h expiry). Fields: id, taskId, url, filename, size, contentType, uploadedBy, createdAt. Cascades on task delete. Max 10MB per file, 10 per task, 100MB per board (enforced server-side). Migration `20260618222516_add_attachments` -- applied to both local and Neon prod.

**Task soft-delete (added 2026-06-28):** `deletedAt DateTime?` and `deletedBy String?` fields on Task. `null` deletedAt = live task; set = in trash. `GET /api/tasks/deleted?boardId=X` returns trash list (educators/TAs on class boards; any member on personal boards) and runs a 30-day lazy purge. `POST /api/tasks/[id]/restore` restores with permission check (original deleter or educator/TA on class boards). Migration `20260627175204_add_task_soft_delete` applied to both local and Neon prod.

**ProWaitlist model (added 2026-06-28):** Early-access email capture for Lecturer Pro. Fields: id, email (unique), source (default "pricing"), createdAt. Public unauthenticated endpoint `POST /api/waitlist` -- rate-limited 5/IP/hour, idempotent upsert on email. Migration `20260627181500_add_pro_waitlist` applied to both local and Neon prod.

**Key indexes to respect:**
- `[column, order]` — always filter by both for board load
- `[boardId, order]` — column ordering
- `[taskId, createdAt]` — activity feed
- `[userId, read]` — unread notification count
