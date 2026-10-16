-- DuplicateDismissal: groups an admin marked "not duplicates" on the Duplicates page.
-- Additive only (one table). Apply by hand BEFORE the deploy that reads it; never plain
-- `prisma db push` on prod. Safe to re-run. Until it is applied the page still works:
-- dismissals read as "none", and Discard shows an error.
CREATE TABLE IF NOT EXISTS "DuplicateDismissal" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "groupKey" TEXT NOT NULL,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DuplicateDismissal_kind_groupKey_key" ON "DuplicateDismissal"("kind", "groupKey");
ALTER TABLE "DuplicateDismissal" ENABLE ROW LEVEL SECURITY;
