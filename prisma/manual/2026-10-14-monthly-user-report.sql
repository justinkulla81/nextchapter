-- MonthlyUserReport: the internal monthly member report, one row per month.
-- Additive only (one table). Apply by hand; never plain `prisma db push` on
-- prod. Until it is applied the admin page shows an empty state and the
-- monthly-user-report cron records a clear failure, so deploying first is safe.
CREATE TABLE IF NOT EXISTS "MonthlyUserReport" (
  "id"          TEXT PRIMARY KEY,
  "monthKey"    TEXT NOT NULL,
  "data"        JSONB NOT NULL,
  "memberCount" INTEGER NOT NULL,
  "trigger"     TEXT NOT NULL DEFAULT 'schedule',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "emailedAt"   TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyUserReport_monthKey_key" ON "MonthlyUserReport"("monthKey");
ALTER TABLE "MonthlyUserReport" ENABLE ROW LEVEL SECURITY;
