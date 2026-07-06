-- AlterTable
ALTER TABLE "User" ADD COLUMN     "proUntil" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
