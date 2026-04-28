-- Add isDone flag to Column so completion detection is not tied to label string.
ALTER TABLE "Column" ADD COLUMN "isDone" BOOLEAN NOT NULL DEFAULT false;

-- Mark the default "Done" column by its known label.
UPDATE "Column" SET "isDone" = true WHERE lower("label") = 'done';
