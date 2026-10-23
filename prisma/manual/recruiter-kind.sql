-- Recruiter kind on CrmPerson. Additive, safe to re-run.
ALTER TABLE "CrmPerson" ADD COLUMN IF NOT EXISTS "recruiterKind" TEXT;
CREATE INDEX IF NOT EXISTS "CrmPerson_recruiterKind_idx" ON "CrmPerson" ("recruiterKind");
