-- BenefitProgram: the catalog of relocation incentives, retraining and tuition
-- funds, grants, dividends, free courses and benefits for laid-off professionals
-- (every state and national). Feeds the CRM "Benefits" tab and the pitch decks.
-- Additive only (one new table). Apply by hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "BenefitProgram" (
  "id"          TEXT PRIMARY KEY,                  -- slug of category + state + name
  "category"    TEXT NOT NULL,                     -- RELOCATION | STATE_TRAINING | FEDERAL | COURSES | PRIVATE | SEGMENT
  "name"        TEXT NOT NULL,
  "provider"    TEXT,
  "scope"       TEXT NOT NULL DEFAULT 'NATIONAL',  -- NATIONAL | STATE | LOCAL
  "state"       TEXT,                              -- 2-letter code, null when national
  "locality"    TEXT,
  "amount"      TEXT,
  "eligibility" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'UNKNOWN',   -- OPEN | ROLLING | CLOSED | UNKNOWN
  "statusNote"  TEXT,
  "url"         TEXT,
  "segments"    TEXT[] NOT NULL DEFAULT '{}',
  "verified"    BOOLEAN NOT NULL DEFAULT false,    -- confirmed on the program's own page
  "checkedAt"   TIMESTAMP(3),
  "source"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BenefitProgram_category_state_idx" ON "BenefitProgram"("category","state");
CREATE INDEX IF NOT EXISTS "BenefitProgram_status_idx" ON "BenefitProgram"("status");
ALTER TABLE "BenefitProgram" ENABLE ROW LEVEL SECURITY;
