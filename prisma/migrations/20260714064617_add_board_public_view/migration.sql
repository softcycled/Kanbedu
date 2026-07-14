-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "publicViewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicViewToken" TEXT;

-- Backfill existing rows with a random unique token before enforcing NOT NULL.
-- Prisma's @default(cuid()) is applied client-side for new rows only; it has
-- no SQL-level equivalent, so existing rows need an explicit backfill here.
UPDATE "Board" SET "publicViewToken" = gen_random_uuid()::text WHERE "publicViewToken" IS NULL;

ALTER TABLE "Board" ALTER COLUMN "publicViewToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Board_publicViewToken_key" ON "Board"("publicViewToken");
