-- CreateTable Board
CREATE TABLE "Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default board
INSERT INTO "Board" ("id", "name", "createdAt") VALUES ('cldefaultboard0000', 'My Board', CURRENT_TIMESTAMP);

-- AddColumn boardId to Column
ALTER TABLE "Column" ADD COLUMN "boardId" TEXT NOT NULL DEFAULT 'cldefaultboard0000';
