-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "column" TEXT NOT NULL DEFAULT 'todo',
    "columnUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigneeId" TEXT,
    "order" REAL NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "movedByNonAssignee" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "column", "columnUpdatedAt", "completedAt", "createdAt", "deadline", "description", "id", "order", "priority", "title", "updatedAt") SELECT "assigneeId", "column", "columnUpdatedAt", "completedAt", "createdAt", "deadline", "description", "id", "order", "priority", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
