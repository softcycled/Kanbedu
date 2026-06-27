-- Soft delete for tasks. Existing rows default to NULL (live, not deleted).
ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "deletedBy" TEXT;

-- Index supports trash listing and the deletedAt IS NULL board-load filter.
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
