-- LinkedInStoryDraft: LinkedIn posts for the non-layoff stories the social stream sends (a list, a hot skill, an AI pay
-- finding, state benefits help, the weekly press post). One enum, one table, nothing existing changes. A draft is written
-- by Claude in LinkedIn's voice, waits for a click (DRAFT -> APPROVED), then posts as the NextChapter page at its slot.
-- Apply before the deploy that reads it.
DO $$ BEGIN
  CREATE TYPE "LinkedInStoryStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "LinkedInStoryDraft" (
  "id" TEXT PRIMARY KEY,
  "factKey" TEXT NOT NULL UNIQUE,
  "topic" TEXT NOT NULL,
  "status" "LinkedInStoryStatus" NOT NULL DEFAULT 'DRAFT',
  "body" TEXT NOT NULL,
  "firstComment" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "facts" JSONB NOT NULL,
  "tags" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "postUrn" TEXT
);
CREATE INDEX IF NOT EXISTS "LinkedInStoryDraft_status_scheduledFor_idx" ON "LinkedInStoryDraft"("status", "scheduledFor");
ALTER TABLE "LinkedInStoryDraft" ENABLE ROW LEVEL SECURITY;
