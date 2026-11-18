-- Academic Affairs workspace (src/lib/higher-ed/workspaces.ts, key 'academic'): a staff role for a college's provost and
-- academic affairs office. Additive. Applied to production 2026-11-18 before the code that reads it.
ALTER TYPE "InstitutionUserRole" ADD VALUE IF NOT EXISTS 'ACADEMIC_AFFAIRS' BEFORE 'WORKFORCE_PARTNER';
