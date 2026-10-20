-- "A hard situation at work": anonymized questions members ask each other, and replies.
-- Additive, re-runnable. RUN BEFORE the deploy that reads them (the page fails soft until then).
CREATE TABLE IF NOT EXISTS "WorkQuestion" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "seniorityBand" TEXT,
  "excludedCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderationStatus" "CommunityModerationStatus" NOT NULL DEFAULT 'PENDING',
  "moderationCategory" "CommunityModerationCategory",
  "moderationConfidence" DOUBLE PRECISION,
  "moderationReasoning" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "reportedAt" TIMESTAMP(3),
  "reportedByCandidateId" TEXT,
  "reportReason" TEXT,
  CONSTRAINT "WorkQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkQuestion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WorkQuestion_isActive_moderationStatus_createdAt_idx" ON "WorkQuestion"("isActive", "moderationStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkQuestion_candidateId_createdAt_idx" ON "WorkQuestion"("candidateId", "createdAt");

CREATE TABLE IF NOT EXISTS "WorkQuestionReply" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderationStatus" "CommunityModerationStatus" NOT NULL DEFAULT 'PENDING',
  "moderationCategory" "CommunityModerationCategory",
  "moderationConfidence" DOUBLE PRECISION,
  "moderationReasoning" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "reportedAt" TIMESTAMP(3),
  "reportedByCandidateId" TEXT,
  "reportReason" TEXT,
  CONSTRAINT "WorkQuestionReply_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkQuestionReply_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "WorkQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkQuestionReply_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WorkQuestionReply_questionId_createdAt_idx" ON "WorkQuestionReply"("questionId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkQuestionReply_candidateId_createdAt_idx" ON "WorkQuestionReply"("candidateId", "createdAt");

-- Match the app's existing tables: the app reaches the database as a trusted server role, and members never query these directly.
ALTER TABLE "WorkQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkQuestionReply" ENABLE ROW LEVEL SECURITY;
