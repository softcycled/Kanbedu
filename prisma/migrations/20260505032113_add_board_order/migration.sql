-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Board" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE TABLE "new_Column" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "boardId" TEXT NOT NULL DEFAULT 'cldefaultboard0000',
    CONSTRAINT "Column_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Column" ("boardId", "id", "isDone", "label", "order") SELECT "boardId", "id", "isDone", "label", "order" FROM "Column";
DROP TABLE "Column";
ALTER TABLE "new_Column" RENAME TO "Column";
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
    "assignee" TEXT NOT NULL DEFAULT '',
    "order" REAL NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium'
);
INSERT INTO "new_Task" ("assignee", "column", "columnUpdatedAt", "completedAt", "createdAt", "deadline", "description", "id", "order", "priority", "title", "updatedAt") SELECT "assignee", "column", "columnUpdatedAt", "completedAt", "createdAt", "deadline", "description", "id", "order", "priority", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
