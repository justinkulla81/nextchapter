-- One row per visitor (IP) per Eastern day with their visitor type, for the Visitors > Activity "Visitors by type" chart. Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "VisitorDayType" (
  "day" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "userType" TEXT NOT NULL,
  "basis" TEXT NOT NULL,
  "views" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("day", "ip")
);
CREATE INDEX IF NOT EXISTS "VisitorDayType_day_userType_idx" ON "VisitorDayType" ("day", "userType");
ALTER TABLE "VisitorDayType" ENABLE ROW LEVEL SECURITY;
