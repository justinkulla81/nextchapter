-- Daily content drafts (src/lib/content/). Additive; safe to run twice.
CREATE TABLE IF NOT EXISTS "ContentDraft" (
  "id" TEXT PRIMARY KEY,
  "day" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "headline" TEXT NOT NULL,
  "big" TEXT NOT NULL,
  "bigLabel" TEXT NOT NULL,
  "campaign" TEXT NOT NULL,
  "versions" JSONB NOT NULL,
  "facts" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentDraft_day_kind_subject_key" ON "ContentDraft" ("day", "kind", "subject");
CREATE INDEX IF NOT EXISTS "ContentDraft_day_idx" ON "ContentDraft" ("day");
CREATE TABLE IF NOT EXISTS "ContentDraftPost" (
  "id" TEXT PRIMARY KEY,
  "draftId" TEXT NOT NULL REFERENCES "ContentDraft"("id") ON DELETE CASCADE,
  "channel" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ContentDraftPost_draftId_idx" ON "ContentDraftPost" ("draftId");
ALTER TABLE "ContentDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentDraftPost" ENABLE ROW LEVEL SECURITY;
