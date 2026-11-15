-- A saved Hunter verification for any email address, not only a CRM contact's (the layoff outreach emails directory addresses, such as a job
-- center's or workforce board's staff, only once Hunter has checked them). status: deliverable (Hunter valid), risky, invalid (invalid or
-- disposable); the same reading mailing-verify uses. Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "AddressVerification" (
  "email"        TEXT PRIMARY KEY,
  "status"       TEXT NOT NULL,
  "hunterStatus" TEXT,
  "score"        INTEGER,
  "checkedAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "source"       TEXT NOT NULL DEFAULT 'layoff-outreach'
);
CREATE INDEX IF NOT EXISTS "AddressVerification_checkedAt_idx" ON "AddressVerification" ("checkedAt");
