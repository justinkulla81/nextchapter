-- ncrawl import fields: location parts, source ids, repost/desc keys, and the
-- years-of-experience requirement read from the full posting text. Additive
-- only: nullable columns (and one constant default), metadata-only on Postgres.
-- Apply by hand before deploying the code that reads them; never plain
-- `prisma db push` on prod.

ALTER TABLE "ExclusiveJobPosting"
  ADD COLUMN IF NOT EXISTS "locationCity" TEXT,
  ADD COLUMN IF NOT EXISTS "locationState" TEXT,
  ADD COLUMN IF NOT EXISTS "locationCountry" TEXT,
  ADD COLUMN IF NOT EXISTS "locationStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "externalJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "requisitionId" TEXT,
  ADD COLUMN IF NOT EXISTS "repostKey" TEXT,
  ADD COLUMN IF NOT EXISTS "descHash" TEXT,
  ADD COLUMN IF NOT EXISTS "yearsRequired" JSONB;

CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_locationState_idx" ON "ExclusiveJobPosting"("locationState");
