-- Coach specialties (functions, skills, styles) and the member's coaching-style assessment.
-- Additive and re-runnable: three array columns, one table, and one data change that makes
-- the (previously inert, default 0) style match weight effective.
--
-- RUN BEFORE the deploy that reads these columns.

ALTER TABLE "Coach" ADD COLUMN IF NOT EXISTS "functions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Coach" ADD COLUMN IF NOT EXISTS "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Coach" ADD COLUMN IF NOT EXISTS "coachingStyles" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "CoachingStyleResponse" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "itemRatings" JSONB NOT NULL,
    "topStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingStyleResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoachingStyleResponse_candidateId_key" ON "CoachingStyleResponse"("candidateId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingStyleResponse_candidateId_fkey') THEN
    ALTER TABLE "CoachingStyleResponse" ADD CONSTRAINT "CoachingStyleResponse_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- The style weight was stored "ahead of time" at 0, i.e. inert. Make it count; an admin can
-- still set it back to 0 in the coaching settings.
ALTER TABLE "CoachingSettings" ALTER COLUMN "matchWeightStyle" SET DEFAULT 3;
UPDATE "CoachingSettings" SET "matchWeightStyle" = 3 WHERE "id" = 'singleton' AND "matchWeightStyle" = 0;
