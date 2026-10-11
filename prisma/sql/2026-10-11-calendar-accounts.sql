-- Several Google accounts can feed the CRM meeting sweep: additive column.
-- Apply once with:
--   npx prisma db execute --file prisma/sql/2026-10-11-calendar-accounts.sql --schema prisma/schema.prisma

ALTER TABLE "AdminGoogleCalendarConnection" ADD COLUMN IF NOT EXISTS "googleEmail" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AdminGoogleCalendarConnection_googleEmail_key"
  ON "AdminGoogleCalendarConnection"("googleEmail");

-- The Gmail connect flow writes the same tokens to both tables, so an existing
-- calendar row can be matched to its account by refresh token.
UPDATE "AdminGoogleCalendarConnection" a SET "googleEmail" = lower(g."email")
FROM "GoogleInboxConnection" g
WHERE a."googleEmail" IS NULL AND a."refreshToken" = g."refreshToken";
