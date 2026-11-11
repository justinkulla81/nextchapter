-- Named staff read off workforce board and job center websites (scripts/boards/crawl-staff.py). Additive, safe to re-run.
-- Separate from the board list (WorkforceBoard director/chair) so staff can be emailed on their own.
CREATE TABLE IF NOT EXISTS "WorkforceStaffContact" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orgKind" TEXT NOT NULL,            -- 'board' | 'center'
  "orgId" TEXT NOT NULL,              -- WorkforceBoard.id, or WorkforceBoardPartner.id of the first center on that site
  "orgName" TEXT NOT NULL,
  "state" TEXT,
  "host" TEXT NOT NULL,               -- the website the person was read from
  "name" TEXT NOT NULL,
  "title" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT,                        -- same values as CrmPerson.workforceStaffRole
  "level" TEXT,                       -- same values as CrmPerson.workforceStaffLevel
  "sourceUrl" TEXT NOT NULL,
  "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkforceStaffContact_host_name_key" ON "WorkforceStaffContact" ("host", lower("name"));
CREATE INDEX IF NOT EXISTS "WorkforceStaffContact_role_level_idx" ON "WorkforceStaffContact" ("role", "level");
CREATE INDEX IF NOT EXISTS "WorkforceStaffContact_email_idx" ON "WorkforceStaffContact" (lower("email"));
ALTER TABLE "WorkforceStaffContact" ENABLE ROW LEVEL SECURITY;

-- 2026-11-11 (later): upsert key, segment, and Hunter verification fields.
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "key" TEXT GENERATED ALWAYS AS ("host" || '|' || lower("name")) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "WorkforceStaffContact_key_key" ON "WorkforceStaffContact" ("key");
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "segment" TEXT; -- workforce_board | job_center | state_rapid_response | econ_dev | dol
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "emailGuessed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "hunterStatus" TEXT;
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "hunterScore" INT;
ALTER TABLE "WorkforceStaffContact" ADD COLUMN IF NOT EXISTS "hunterCheckedAt" TIMESTAMPTZ;
