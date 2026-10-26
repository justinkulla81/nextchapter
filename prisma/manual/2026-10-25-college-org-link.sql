-- Additive: one row per college linking it to its CRM organization (see scripts/colleges/link-crm.ts).
-- The public college pages work without it (name match); the Review List section and the admin link use it.
CREATE TABLE IF NOT EXISTS "CollegeOrgLink" (
  "unitid"       TEXT PRIMARY KEY,
  "crmOrgId"     TEXT,
  "matchStatus"  TEXT NOT NULL DEFAULT 'REVIEW',
  "reviewOrgId"  TEXT,
  "reviewReason" TEXT,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CollegeOrgLink_matchStatus_idx" ON "CollegeOrgLink"("matchStatus");
CREATE INDEX IF NOT EXISTS "CollegeOrgLink_crmOrgId_idx" ON "CollegeOrgLink"("crmOrgId");
