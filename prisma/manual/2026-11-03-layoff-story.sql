-- Layoff stories (/layoffs/stories). Additive: two new tables, no existing table touched.
-- Answers count toward company numbers once the email is confirmed; a story is shown only after a person approves it and LAYOFF_STORIES_PUBLISH is on.
CREATE TABLE IF NOT EXISTS "LayoffStory" (
  "id"                TEXT PRIMARY KEY,
  "companySlug"       TEXT,
  "companyName"       TEXT NOT NULL,
  "toldMonth"         TEXT NOT NULL,
  "fn"                TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "level"             TEXT NOT NULL,
  "tenure"            TEXT NOT NULL DEFAULT '',
  "foundOut"          TEXT NOT NULL DEFAULT '',
  "noticeGiven"       TEXT NOT NULL DEFAULT '',
  "warnNotice"        TEXT NOT NULL DEFAULT '',
  "severance"         TEXT NOT NULL DEFAULT '',
  "signedRelease"     TEXT NOT NULL DEFAULT '',
  "whereNow"          TEXT NOT NULL DEFAULT '',
  "helpWanted"        TEXT NOT NULL DEFAULT '',
  "body"              TEXT NOT NULL DEFAULT '',
  -- PRIVATE | ANONYMOUS | NAMED
  "visibility"        TEXT NOT NULL DEFAULT 'PRIVATE',
  -- UNVERIFIED | PENDING_EMAIL | COUNTED | PENDING_REVIEW | APPROVED | REJECTED | WITHDRAWN
  "status"            TEXT NOT NULL DEFAULT 'PENDING_EMAIL',
  "tokenHash"         TEXT,
  "tokenExpiresAt"    TIMESTAMP(3),
  "withdrawTokenHash" TEXT NOT NULL,
  "emailVerifiedAt"   TIMESTAMP(3),
  "reviewedAt"        TIMESTAMP(3),
  "reviewNote"        TEXT,
  "withdrawnAt"       TIMESTAMP(3),
  "ipHash"            TEXT,
  "source"            TEXT NOT NULL DEFAULT '',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LayoffStory_tokenHash_key" ON "LayoffStory"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "LayoffStory_withdrawTokenHash_key" ON "LayoffStory"("withdrawTokenHash");
CREATE INDEX IF NOT EXISTS "LayoffStory_companySlug_status_idx" ON "LayoffStory"("companySlug", "status");
CREATE INDEX IF NOT EXISTS "LayoffStory_status_createdAt_idx" ON "LayoffStory"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "LayoffStoryIdentity" (
  "storyId"   TEXT PRIMARY KEY,
  "email"     TEXT NOT NULL,
  "name"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LayoffStoryIdentity_email_idx" ON "LayoffStoryIdentity"("email");
-- The app reads these tables through the service connection only.
ALTER TABLE "LayoffStory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LayoffStoryIdentity" ENABLE ROW LEVEL SECURITY;
