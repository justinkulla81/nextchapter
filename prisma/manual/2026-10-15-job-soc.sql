-- O*NET-SOC occupation per imported job (ncrawl matches the title against O*NET
-- alternate titles; import-jobs.py sends socCode / socTitle). Additive only:
-- nullable columns, metadata-only on Postgres. Apply before deploying the code
-- that writes them; never plain `prisma db push` on prod.

ALTER TABLE "ExclusiveJobPosting"
  ADD COLUMN IF NOT EXISTS "socCode" TEXT,
  ADD COLUMN IF NOT EXISTS "socTitle" TEXT;

CREATE INDEX IF NOT EXISTS "ExclusiveJobPosting_socCode_idx" ON "ExclusiveJobPosting"("socCode");
