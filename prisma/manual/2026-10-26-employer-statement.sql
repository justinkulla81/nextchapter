-- Employer statements next to a WARN notice on the layoff pages (/layoffs/company/<slug>, /network/company/<slug>). Additive: one new table, no existing table touched.
-- A statement goes live only after the author confirms a work email and a person on the team approves it.
CREATE TABLE IF NOT EXISTS "EmployerStatement" (
  "id"              TEXT PRIMARY KEY,
  "companySlug"     TEXT NOT NULL,
  "warnNoticeId"    TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "authorName"      TEXT NOT NULL,
  "authorTitle"     TEXT NOT NULL,
  "authorEmail"     TEXT NOT NULL,
  "emailDomain"     TEXT NOT NULL,
  "tokenHash"       TEXT NOT NULL,
  "tokenExpiresAt"  TIMESTAMP(3) NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  -- PENDING_EMAIL | PENDING_REVIEW | APPROVED | REJECTED
  "status"          TEXT NOT NULL DEFAULT 'PENDING_EMAIL',
  "reviewedAt"      TIMESTAMP(3),
  "reviewNote"      TEXT,
  "ipHash"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployerStatement_tokenHash_key" ON "EmployerStatement"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmployerStatement_companySlug_status_idx" ON "EmployerStatement"("companySlug", "status");
CREATE INDEX IF NOT EXISTS "EmployerStatement_warnNoticeId_idx" ON "EmployerStatement"("warnNoticeId");
CREATE INDEX IF NOT EXISTS "EmployerStatement_status_createdAt_idx" ON "EmployerStatement"("status", "createdAt");
-- The app reads this table through the service connection only, like the other admin-reviewed tables.
ALTER TABLE "EmployerStatement" ENABLE ROW LEVEL SECURITY;
