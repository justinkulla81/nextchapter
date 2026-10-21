-- Sub-functions (2026-10-16): the finer kind of work inside Operations, Engineering,
-- Finance, People and Sales (src/lib/jobs/sub-functions.ts), so the board's "Your
-- field" is the member's own sub-function. On the job (set at import, backfilled by
-- scripts/careers/backfill-sub-functions.ts) and on the member (derived from their
-- profile when the board loads).
--
-- Additive only: nullable columns, no default, no index (the board reads them into
-- memory). Apply by hand before deploying the code; never `prisma db push` on prod.

ALTER TABLE "ExclusiveJobPosting" ADD COLUMN IF NOT EXISTS "subFunction" TEXT;
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "subFunction" TEXT;
