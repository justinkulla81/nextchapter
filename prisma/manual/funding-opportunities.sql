-- FundingOpportunity: open federal grants (Grants.gov) and solicitations / RFIs
-- (SAM.gov) found by /api/cron/funding-opportunities, with what NextChapter and
-- its customers can do about each. Additive only (one new table). Apply by
-- hand; never plain `prisma db push` on prod. Until it is applied the cron
-- still files CRM notes and reports the store as unavailable.
CREATE TABLE IF NOT EXISTS "FundingOpportunity" (
  "id"              TEXT PRIMARY KEY,                 -- "<source>:<externalId>"
  "source"          TEXT NOT NULL,                    -- grants.gov | sam.gov
  "externalId"      TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "kind"            TEXT NOT NULL,                    -- GRANT | FORECAST | RFP | RFI | PRESOLICITATION
  "audience"        TEXT NOT NULL,                    -- CUSTOMERS (for them to win) | US (for us to bid)
  "eligibility"     TEXT NOT NULL,                    -- DIRECT | VIA_PARTNER | UNKNOWN (NOT_ELIGIBLE is never stored)
  "applicantKinds"  TEXT[] NOT NULL DEFAULT '{}',
  "partnerKinds"    TEXT[] NOT NULL DEFAULT '{}',
  "states"          TEXT[] NOT NULL DEFAULT '{}',   -- applicants limited to these states; empty = nationwide
  "eligibilityNote" TEXT,
  "agency"          TEXT NOT NULL,
  "orgId"           TEXT,                             -- the issuing agency's CrmOrganization, when filed
  "url"             TEXT NOT NULL,
  "state"           TEXT,
  "postedAt"        TIMESTAMP(3),
  "closesAt"        TIMESTAMP(3),
  "awardCeiling"    DOUBLE PRECISION,
  "firstSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FundingOpportunity_source_externalId_key" ON "FundingOpportunity"("source","externalId");
CREATE INDEX IF NOT EXISTS "FundingOpportunity_closesAt_idx" ON "FundingOpportunity"("closesAt");
CREATE INDEX IF NOT EXISTS "FundingOpportunity_audience_eligibility_idx" ON "FundingOpportunity"("audience","eligibility");
ALTER TABLE "FundingOpportunity" ENABLE ROW LEVEL SECURITY;
-- Added after the first apply (state scoping): safe to re-run.
ALTER TABLE "FundingOpportunity" ADD COLUMN IF NOT EXISTS "states" TEXT[] NOT NULL DEFAULT '{}';
