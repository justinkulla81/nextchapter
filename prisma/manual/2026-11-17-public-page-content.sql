-- What a paid organization writes on its own public page (owner decision 2026-11-17). Additive and safe to re-run.
CREATE TABLE IF NOT EXISTS "PublicPageContent" (
  "id" TEXT NOT NULL,
  "crmOrganizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "firstApprovedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "reviewedBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicPageContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PublicPageContent_crmOrganizationId_key" ON "PublicPageContent"("crmOrganizationId");
CREATE INDEX IF NOT EXISTS "PublicPageContent_status_idx" ON "PublicPageContent"("status");
ALTER TABLE "PublicPageContent" ENABLE ROW LEVEL SECURITY;
