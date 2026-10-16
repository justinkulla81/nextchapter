-- InternshipPosting: internships live only in Higher Ed portals (owner rule),
-- in their own table so no member-board read can reach them. Additive only
-- (one new table). Apply by hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "InternshipPosting" (
  "id" TEXT PRIMARY KEY,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyId" TEXT,
  "location" TEXT,
  "locationState" TEXT,
  "remote" BOOLEAN NOT NULL DEFAULT false,
  "field" TEXT,
  "term" TEXT,
  "termYear" INTEGER,
  "deadline" TIMESTAMP(3),
  "description" TEXT,
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "payPeriod" TEXT,
  "sourceName" TEXT,
  "addedBy" TEXT NOT NULL DEFAULT 'ncrawl',
  "institutionId" TEXT,
  "postedAt" TIMESTAMP(3),
  "lastConfirmedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternshipPosting_url_key" ON "InternshipPosting"("url");
CREATE INDEX IF NOT EXISTS "InternshipPosting_archivedAt_field_idx" ON "InternshipPosting"("archivedAt", "field");
CREATE INDEX IF NOT EXISTS "InternshipPosting_institutionId_idx" ON "InternshipPosting"("institutionId");
CREATE INDEX IF NOT EXISTS "InternshipPosting_addedBy_lastConfirmedAt_idx" ON "InternshipPosting"("addedBy", "lastConfirmedAt");
ALTER TABLE "InternshipPosting" ENABLE ROW LEVEL SECURITY;
