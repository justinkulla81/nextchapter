-- Paid search (Google Ads) spend the admin types in on Visitor activity, one row per Eastern day and segment ('b2c' | 'b2b').
-- Additive only; safe to re-run. Apply before deploying the code that reads it (the code also fails soft without it).
CREATE TABLE IF NOT EXISTS "SemSpend" (
  "day" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("day", "segment")
);
