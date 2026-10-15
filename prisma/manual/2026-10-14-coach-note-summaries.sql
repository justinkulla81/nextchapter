-- Coach note summaries (AI-written, cached) and the per-call run log used for the daily cap.
-- Additive and re-runnable. Coach and CandidateProfile gain relation fields in Prisma only.
CREATE TABLE IF NOT EXISTS "CoachNoteSummary" (
    "coachId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachNoteSummary_pkey" PRIMARY KEY ("coachId","candidateId"),
    CONSTRAINT "CoachNoteSummary_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoachNoteSummary_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CoachNoteSummaryRun" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "inputChars" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachNoteSummaryRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CoachNoteSummaryRun_coachId_createdAt_idx" ON "CoachNoteSummaryRun"("coachId","createdAt");

ALTER TABLE "CoachNoteSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachNoteSummaryRun" ENABLE ROW LEVEL SECURITY;
