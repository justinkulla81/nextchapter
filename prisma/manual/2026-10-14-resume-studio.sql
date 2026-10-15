-- Resume Studio drafts. Additive and re-runnable. CandidateProfile gains a relation
-- field in Prisma only, no new column, so this can run before or after the deploy.
CREATE TABLE IF NOT EXISTS "ResumeDraft" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT 'classic',
    "document" JSONB NOT NULL,
    "jobDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResumeDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResumeDraft_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ResumeDraft_candidateId_updatedAt_idx" ON "ResumeDraft"("candidateId","updatedAt");
ALTER TABLE "ResumeDraft" ENABLE ROW LEVEL SECURITY;
