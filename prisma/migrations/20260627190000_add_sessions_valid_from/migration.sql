-- Sign-out-everywhere cutoff. Tokens issued before this instant are rejected.
-- NULL (default for existing users) means no revocation has occurred.
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
