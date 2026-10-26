-- Conferences v3: who added an entry, and rejection with a note. Additive only; safe to re-run.
-- Apply by hand before the deploy that reads these columns; never plain `prisma db push` on prod.
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "addedBy" TEXT;
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "ConferenceEvent" ADD COLUMN IF NOT EXISTS "rejectedNote" TEXT;
