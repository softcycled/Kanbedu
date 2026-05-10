-- Add priority field to Task, defaulting existing tasks to "medium"
ALTER TABLE "Task" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
