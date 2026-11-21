-- A program belongs to one school of a university (null = the whole institution), and a school can open it to alumni of
-- its other schools (owner, 2026-11-21: a law alum in business sees the business school's exec ed when it opts in).
-- Default off: a school's programs show only to its own alumni until it opens them. Additive; safe to re-run.
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "school" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "openToOtherSchools" BOOLEAN NOT NULL DEFAULT false;
