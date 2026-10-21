-- LinkedInPostDraft: suggested LinkedIn posts about credible layoffs. Additive only
-- (one enum, one table). Apply before the deploy that reads it.
DO $$ BEGIN
  CREATE TYPE "LinkedInDraftStatus" AS ENUM ('DRAFT', 'POSTED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "LinkedInPostDraft" (
  "id" TEXT PRIMARY KEY,
  "noticeId" TEXT NOT NULL UNIQUE REFERENCES "WarnNotice"("id") ON DELETE CASCADE,
  "status" "LinkedInDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "angle" TEXT NOT NULL,
  "layout" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "firstComment" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "rewrittenAt" TIMESTAMP(3),
  "facts" JSONB NOT NULL,
  "credibility" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "LinkedInPostDraft_status_scheduledFor_idx" ON "LinkedInPostDraft"("status", "scheduledFor");
ALTER TABLE "LinkedInPostDraft" ENABLE ROW LEVEL SECURITY;
