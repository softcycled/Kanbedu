-- Add educator-set display name override to ClassMember
ALTER TABLE "ClassMember" ADD COLUMN "displayName" TEXT;

-- CreateTable
CREATE TABLE "ClassRosterEntry" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT,
    "claimedBy" TEXT,

    CONSTRAINT "ClassRosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassRosterEntry_classId_email_key" ON "ClassRosterEntry"("classId", "email");

-- CreateIndex
CREATE INDEX "ClassRosterEntry_classId_idx" ON "ClassRosterEntry"("classId");

-- AddForeignKey
ALTER TABLE "ClassRosterEntry" ADD CONSTRAINT "ClassRosterEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
