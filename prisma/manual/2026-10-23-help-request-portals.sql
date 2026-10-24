-- Partner-portal support: HelpRequest can now come from the employer,
-- recruiter, coach and institution portals. All additive; candidateId only
-- loses NOT NULL. Safe to run more than once.
ALTER TABLE "HelpRequest" ALTER COLUMN "candidateId" DROP NOT NULL;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "portal" TEXT NOT NULL DEFAULT 'CANDIDATE';
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "requesterName" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "requesterEmail" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "requesterOrg" TEXT;
CREATE INDEX IF NOT EXISTS "HelpRequest_portal_status_idx" ON "HelpRequest"("portal", "status");
