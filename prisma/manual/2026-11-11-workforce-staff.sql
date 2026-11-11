-- Workforce staff list on CrmPerson (people at workforce boards, job centers, state workforce agencies).
-- Additive, safe to re-run. Written by scripts/crm/workforce-staff.ts from the person's title.
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "workforceStaffRole" TEXT;
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "workforceStaffLevel" TEXT;
CREATE INDEX IF NOT EXISTS "CrmPerson_workforceStaffRole_idx" ON "CrmPerson" ("workforceStaffRole");
