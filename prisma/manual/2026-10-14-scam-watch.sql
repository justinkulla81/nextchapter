-- CreateEnum
CREATE TYPE "ScamAlertLevel" AS ENUM ('SUSPICIOUS', 'LIKELY_FAKE');

-- AlterTable
ALTER TABLE "EmailConnection" ADD COLUMN     "pushWatchExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScamAlert" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "connectionId" TEXT,
    "externalMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "level" "ScamAlertLevel" NOT NULL,
    "score" INTEGER NOT NULL,
    "claimedCompany" TEXT,
    "fromAddress" TEXT,
    "subject" TEXT,
    "flaggedDomains" TEXT[],
    "signals" JSONB NOT NULL,
    "emailDate" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertEmailSentAt" TIMESTAMP(3),
    "markedLegitAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "ScamAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScamAlert_candidateId_detectedAt_idx" ON "ScamAlert"("candidateId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScamAlert_candidateId_externalMessageId_key" ON "ScamAlert"("candidateId", "externalMessageId");

-- AddForeignKey
ALTER TABLE "ScamAlert" ADD CONSTRAINT "ScamAlert_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security on, no policies: same posture as the other candidate
-- tables (all access goes through the server's Prisma connection; nothing is
-- readable through the public API).
ALTER TABLE "ScamAlert" ENABLE ROW LEVEL SECURITY;
