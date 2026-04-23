-- Add lightweight task metadata timestamps.
ALTER TABLE "Task" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE "Task" ADD COLUMN "completedAt" DATETIME;