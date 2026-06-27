-- Lecturer Pro early-access waitlist, captured from the pricing page.
CREATE TABLE "ProWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pricing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProWaitlist_email_key" ON "ProWaitlist"("email");

CREATE INDEX "ProWaitlist_createdAt_idx" ON "ProWaitlist"("createdAt");
