-- Fix missing ON DELETE CASCADE on foreign keys that default to Restrict.
-- Without these, deleting a Board (group deletion) crashes on Column rows,
-- and deleting a User crashes if they have activity, description, bug, or attachment records.

ALTER TABLE "Column" DROP CONSTRAINT "Column_boardId_fkey";
ALTER TABLE "Column" ADD CONSTRAINT "Column_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskActivity" DROP CONSTRAINT "TaskActivity_userId_fkey";
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDescriptionVersion" DROP CONSTRAINT "TaskDescriptionVersion_userId_fkey";
ALTER TABLE "TaskDescriptionVersion" ADD CONSTRAINT "TaskDescriptionVersion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BugReport" DROP CONSTRAINT "BugReport_userId_fkey";
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedBy_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
