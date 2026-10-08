-- CreateEnum
CREATE TYPE "PortalKind" AS ENUM ('COACH', 'RECRUITER', 'EMPLOYER', 'TALENT', 'CRUCIBLE_EMPLOYER', 'EQOVERIQ_CONTRIBUTOR');

-- CreateTable
CREATE TABLE "JobSearchDailySend" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickLink" TEXT,
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "JobSearchDailySend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalPageActivityEvent" (
    "id" TEXT NOT NULL,
    "portal" "PortalKind" NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "HomepageVisitEventType" NOT NULL,
    "path" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalPageActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSearchDailySend_resendEmailId_key" ON "JobSearchDailySend"("resendEmailId");

-- CreateIndex
CREATE INDEX "JobSearchDailySend_candidateId_sentAt_idx" ON "JobSearchDailySend"("candidateId", "sentAt");

-- CreateIndex
CREATE INDEX "JobSearchDailySend_sentAt_idx" ON "JobSearchDailySend"("sentAt");

-- CreateIndex
CREATE INDEX "PortalPageActivityEvent_portal_createdAt_idx" ON "PortalPageActivityEvent"("portal", "createdAt");

-- CreateIndex
CREATE INDEX "PortalPageActivityEvent_userId_createdAt_idx" ON "PortalPageActivityEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobSearchDailySend" ADD CONSTRAINT "JobSearchDailySend_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

