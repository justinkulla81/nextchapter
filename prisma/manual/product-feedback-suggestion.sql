-- Feedback points found in meeting notes, waiting for the owner to approve or dismiss them
-- (Vision > Feedback > "Suggested from meetings"). Additive; safe to re-run.
DO $$ BEGIN
  CREATE TYPE "ProductFeedbackSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductFeedbackSuggestion" (
  "id" TEXT PRIMARY KEY,
  "sourceRef" TEXT NOT NULL,
  "personId" TEXT,
  "candidateId" TEXT,
  "personLabel" TEXT,
  "source" "ProductFeedbackSource" NOT NULL DEFAULT 'OTHER',
  "theme" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "meetingTitle" TEXT,
  "meetingAt" TIMESTAMP(3) NOT NULL,
  "notesUrl" TEXT,
  "status" "ProductFeedbackSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "feedbackId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductFeedbackSuggestion_sourceRef_key" ON "ProductFeedbackSuggestion"("sourceRef");
CREATE INDEX IF NOT EXISTS "ProductFeedbackSuggestion_status_meetingAt_idx" ON "ProductFeedbackSuggestion"("status", "meetingAt" DESC);
CREATE INDEX IF NOT EXISTS "ProductFeedbackSuggestion_personId_idx" ON "ProductFeedbackSuggestion"("personId");
ALTER TABLE "ProductFeedbackSuggestion" ENABLE ROW LEVEL SECURITY;
