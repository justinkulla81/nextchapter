-- CreateEnum
CREATE TYPE "PlatformKind" AS ENUM ('WORK', 'LEARNING');

-- CreateEnum
CREATE TYPE "PlatformStage" AS ENUM ('SIGNED_UP', 'IN_VETTING', 'ACCEPTED', 'WORKING', 'EARNING', 'ENROLLED', 'LEARNING', 'EXAM_BOOKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlatformHealth" AS ENUM ('ACTIVE', 'FALLING_BEHIND', 'GONE_QUIET', 'NOT_ACCEPTED');

-- CreateTable
CREATE TABLE "CandidatePlatformActivity" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "kind" "PlatformKind" NOT NULL,
    "stage" "PlatformStage" NOT NULL,
    "stageAt" TIMESTAMP(3) NOT NULL,
    "health" "PlatformHealth" NOT NULL DEFAULT 'ACTIVE',
    "healthAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastEmailAt" TIMESTAMP(3) NOT NULL,
    "lastProgressAt" TIMESTAMP(3),
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "lastSubject" TEXT,
    "courseTitle" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePlatformActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePlatformEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "stage" "PlatformStage",
    "signal" "PlatformHealth",
    "emailAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidatePlatformEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidatePlatformActivity_platformKey_stage_idx" ON "CandidatePlatformActivity"("platformKey", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePlatformActivity_candidateId_platformKey_key" ON "CandidatePlatformActivity"("candidateId", "platformKey");

-- CreateIndex
CREATE INDEX "CandidatePlatformEvent_candidateId_emailAt_idx" ON "CandidatePlatformEvent"("candidateId", "emailAt");

-- CreateIndex
CREATE INDEX "CandidatePlatformEvent_platformKey_idx" ON "CandidatePlatformEvent"("platformKey");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePlatformEvent_candidateId_externalMessageId_key" ON "CandidatePlatformEvent"("candidateId", "externalMessageId");

-- AddForeignKey
ALTER TABLE "CandidatePlatformActivity" ADD CONSTRAINT "CandidatePlatformActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePlatformEvent" ADD CONSTRAINT "CandidatePlatformEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same as the other app tables: no direct reads for authenticated roles;
-- the app reads through Prisma as the table owner, which bypasses RLS.
ALTER TABLE "CandidatePlatformActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidatePlatformEvent" ENABLE ROW LEVEL SECURITY;
