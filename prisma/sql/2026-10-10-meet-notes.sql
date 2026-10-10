-- Meet links + Gemini notes on CRM meetings: additive, nullable columns only.
-- Apply once with:
--   npx prisma db execute --file prisma/sql/2026-10-10-meet-notes.sql --schema prisma/schema.prisma

ALTER TABLE "CrmActivity" ADD COLUMN IF NOT EXISTS "meetUrl" TEXT;
ALTER TABLE "CrmActivity" ADD COLUMN IF NOT EXISTS "notesDocUrl" TEXT;
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "nextMeetingUrl" TEXT;
