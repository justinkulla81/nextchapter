-- PartnerAuditEvent: one audit trail for every partner portal. Additive only
-- (one new table; reuses the OrgWorkspaceType enum from 2026-10-15-organizations.sql).
-- Apply by hand; never plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "PartnerAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "portal" "OrgWorkspaceType" NOT NULL,
  "refId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorLabel" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PartnerAuditEvent_portal_refId_createdAt_idx" ON "PartnerAuditEvent"("portal", "refId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartnerAuditEvent_actorUserId_createdAt_idx" ON "PartnerAuditEvent"("actorUserId", "createdAt");
ALTER TABLE "PartnerAuditEvent" ENABLE ROW LEVEL SECURITY;
