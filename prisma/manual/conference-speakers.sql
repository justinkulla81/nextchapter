-- Public conference pages: named speakers (keynotes, panelists, moderators, session speakers). Additive only; safe to re-run.
-- Apply by hand (never plain `prisma db push` on prod). Empty until filled; the page shows the block only when rows exist.
CREATE TABLE IF NOT EXISTS "ConferenceSpeaker" (
  "id" TEXT PRIMARY KEY,
  "seriesId" TEXT NOT NULL REFERENCES "ConferenceEvent"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "organization" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'SPEAKER',
  "sessionTitle" TEXT,
  "year" INTEGER,
  "sourceUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConferenceSpeaker_seriesId_name_kind_key" ON "ConferenceSpeaker"("seriesId","name","kind");
CREATE INDEX IF NOT EXISTS "ConferenceSpeaker_seriesId_idx" ON "ConferenceSpeaker"("seriesId");
