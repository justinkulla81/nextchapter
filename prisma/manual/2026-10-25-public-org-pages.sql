-- Public organization pages: link each American Job Center / economic development organization / workforce board
-- to its CRM organization. Additive; the pages work without it (the claim button and CRM link just stay off).
CREATE TABLE IF NOT EXISTS "PublicOrgPage" (
  "kind"         TEXT NOT NULL,
  "sourceId"     TEXT NOT NULL,
  "state"        TEXT NOT NULL,
  "crmOrgId"     TEXT,
  "matchStatus"  TEXT NOT NULL DEFAULT 'NONE',
  "reviewOrgId"  TEXT,
  "reviewReason" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicOrgPage_pkey" PRIMARY KEY ("kind", "sourceId")
);
CREATE INDEX IF NOT EXISTS "PublicOrgPage_crmOrgId_idx" ON "PublicOrgPage"("crmOrgId");
CREATE INDEX IF NOT EXISTS "PublicOrgPage_matchStatus_idx" ON "PublicOrgPage"("matchStatus");
