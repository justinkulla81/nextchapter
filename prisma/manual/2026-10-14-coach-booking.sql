-- Coach session booking: weekly hours, settings and bookings. Additive and re-runnable.
-- Coach and CandidateProfile gain relation fields in Prisma only, no new columns, so this
-- can run before or after the deploy.
CREATE TABLE IF NOT EXISTS "CoachBookingSettings" (
    "coachId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "slotMinutes" INTEGER NOT NULL DEFAULT 45,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 21,
    "fallbackMeetingUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachBookingSettings_pkey" PRIMARY KEY ("coachId"),
    CONSTRAINT "CoachBookingSettings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CoachAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "CoachAvailabilityWindow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachAvailabilityWindow_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CoachAvailabilityWindow_coachId_idx" ON "CoachAvailabilityWindow"("coachId");

CREATE TABLE IF NOT EXISTS "CoachBooking" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "cancelledBy" TEXT,
    "meetUrl" TEXT,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoachBooking_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachBooking_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CoachBooking_coachId_startsAt_idx" ON "CoachBooking"("coachId","startsAt");
CREATE INDEX IF NOT EXISTS "CoachBooking_candidateId_startsAt_idx" ON "CoachBooking"("candidateId","startsAt");

ALTER TABLE "CoachBookingSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachAvailabilityWindow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachBooking" ENABLE ROW LEVEL SECURITY;
