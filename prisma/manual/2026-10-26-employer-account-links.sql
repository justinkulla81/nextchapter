-- Link my other account (employer sections build plan, decision 6). Additive only: one new table.
-- Nothing is dropped, renamed or rewritten. The code fails soft while this is missing (the chooser shows only the
-- sections of the signed-in account, as today), so this can be applied before or after the deploy.
-- Apply by hand; never plain `prisma db push` on prod. Not applied yet.

CREATE TABLE IF NOT EXISTS "EmployerAccountLink" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "otherUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "removedBy" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployerAccountLink_tokenHash_key" ON "EmployerAccountLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmployerAccountLink_userId_status_idx" ON "EmployerAccountLink"("userId", "status");
CREATE INDEX IF NOT EXISTS "EmployerAccountLink_otherUserId_status_idx" ON "EmployerAccountLink"("otherUserId", "status");
ALTER TABLE "EmployerAccountLink" ENABLE ROW LEVEL SECURITY;
