-- Resume studio spelling, grammar and stronger-bullet helpers: a log of model calls, for the daily cap and for
-- spend reporting. Additive and re-runnable. The code treats a missing table as "no cap" and carries on,
-- so this can run before or after the deploy. No resume text is stored.
CREATE TABLE IF NOT EXISTS "ResumePolishRun" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputChars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumePolishRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ResumePolishRun_candidateId_createdAt_idx" ON "ResumePolishRun"("candidateId","createdAt");
ALTER TABLE "ResumePolishRun" ENABLE ROW LEVEL SECURITY;
