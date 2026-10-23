-- The program's own page for a lead (application or about page). Additive and nullable;
-- run before deploying. Filled for existing grants leads by scripts/crm/backfill-lead-links.ts.
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "url" TEXT;
