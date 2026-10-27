-- Organizations whose website we tried and could not read brand colors from, so the brand scan does not retry them every run (src/lib/branding). Additive: one new table.
CREATE TABLE IF NOT EXISTS "OrgBrandMiss" (
  "kind"      TEXT NOT NULL,
  "sourceId"  TEXT NOT NULL,
  "reason"    TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgBrandMiss_pkey" PRIMARY KEY ("kind", "sourceId")
);
CREATE INDEX IF NOT EXISTS "OrgBrandMiss_checkedAt_idx" ON "OrgBrandMiss"("checkedAt");
