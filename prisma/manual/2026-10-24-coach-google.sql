-- Per-coach Google Calendar connection (separate coach OAuth client). Additive only: one table, one column.
-- Apply by hand before the deploy; never plain `prisma db push` on prod.
-- The feature stays off until COACH_GOOGLE_CLIENT_ID and COACH_GOOGLE_CLIENT_SECRET are set, so applying this changes nothing by itself.
CREATE TABLE IF NOT EXISTS "CoachGoogleConnection" (
  "coachId" TEXT NOT NULL,
  "googleEmail" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL DEFAULT '',
  "refreshToken" TEXT NOT NULL DEFAULT '',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "disconnectReason" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "conflictCalendarIds" TEXT[] NOT NULL DEFAULT ARRAY['primary']::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachGoogleConnection_pkey" PRIMARY KEY ("coachId"),
  CONSTRAINT "CoachGoogleConnection_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Which calendar a booking's event lives on: NULL = NextChapter's shared calendar (the original flow).
ALTER TABLE "CoachBooking" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
