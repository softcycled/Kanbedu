/*
  Warnings:

  - You are about to drop the column `githubRepo` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `githubAccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `githubId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[realtimeSecret]` on the table `Board` will be added. If there are existing duplicate values, this will fail.
  - The required column `realtimeSecret` was added to the `Board` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "User_githubId_key";

-- AlterTable
ALTER TABLE "Board" DROP COLUMN "githubRepo",
ADD COLUMN     "realtimeSecret" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "githubAccessToken",
DROP COLUMN "githubId";

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term" TEXT,
    "ownerId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "groupId" TEXT,

    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "boardId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPreset" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "tasks" JSONB NOT NULL,

    CONSTRAINT "ClassPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_identifier_route_key" ON "RateLimit"("identifier", "route");

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");

-- CreateIndex
CREATE INDEX "Class_ownerId_idx" ON "Class"("ownerId");

-- CreateIndex
CREATE INDEX "ClassMember_classId_idx" ON "ClassMember"("classId");

-- CreateIndex
CREATE INDEX "ClassMember_groupId_idx" ON "ClassMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassMember_userId_classId_key" ON "ClassMember"("userId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_boardId_key" ON "Group"("boardId");

-- CreateIndex
CREATE INDEX "Group_classId_idx" ON "Group"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPreset_classId_key" ON "ClassPreset"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Board_realtimeSecret_key" ON "Board"("realtimeSecret");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "TaskColumnHistory_taskId_enteredAt_idx" ON "TaskColumnHistory"("taskId", "enteredAt");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPreset" ADD CONSTRAINT "ClassPreset_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
