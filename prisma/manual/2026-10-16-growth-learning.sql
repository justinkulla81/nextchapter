-- Growth and Learning programs (applied 2026-10-15/16 via migrate diff, additive only).
-- New tables are server-only (Prisma); no PostgREST access.
ALTER TABLE "OrgCourse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgCourseProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InternalRoleInterest" ENABLE ROW LEVEL SECURITY;
