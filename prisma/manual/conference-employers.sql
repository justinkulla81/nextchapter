-- Public conference pages: employers known to exhibit, sponsor, speak or attend. Additive only; safe to re-run.
-- Apply by hand (never plain `prisma db push` on prod). Empty until filled; the page shows the block only when rows exist.
CREATE TABLE IF NOT EXISTS "ConferenceEmployer" (
  "id" TEXT PRIMARY KEY,
  "seriesId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "companyId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'EXHIBITOR',
  "year" INTEGER,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceEmployer_seriesId_name_role_key" ON "ConferenceEmployer"("seriesId","name","role");
CREATE INDEX IF NOT EXISTS "ConferenceEmployer_seriesId_idx" ON "ConferenceEmployer"("seriesId");
CREATE INDEX IF NOT EXISTS "ConferenceEmployer_companyId_idx" ON "ConferenceEmployer"("companyId");
