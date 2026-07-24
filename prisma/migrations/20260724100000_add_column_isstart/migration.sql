-- Start columns (backlog / wishlist / to-do): cards park here by design, so
-- they never accrue the "waiting" signal. Symmetric to isDone; a column is
-- Start OR Done OR neither (active). Multiple Start columns per board allowed.
ALTER TABLE "Column" ADD COLUMN "isStart" BOOLEAN NOT NULL DEFAULT false;

-- Backfill preserves today's behavior: only the leftmost (lowest-order) column
-- was exempt from "waiting" before this change. Mark each board's first
-- non-done column as a Start column so existing boards behave identically;
-- lecturers can opt additional backlog columns into Start afterwards.
UPDATE "Column" c
SET "isStart" = true
FROM (
  SELECT DISTINCT ON ("boardId") id
  FROM "Column"
  WHERE "isDone" = false
  ORDER BY "boardId", "order" ASC
) f
WHERE c.id = f.id;
