-- Connected portals (2026-11-18). Additive: two new tables.
CREATE TABLE IF NOT EXISTS "PortalConnection" (
  "id" TEXT PRIMARY KEY,
  "requesterKind" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requesterShares" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetShares" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedBy" TEXT,
  "respondedAt" TIMESTAMP(3),
  "endedBy" TEXT,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalConnection_requesterKind_requesterId_targetKind_targetId_key" ON "PortalConnection"("requesterKind", "requesterId", "targetKind", "targetId");
CREATE INDEX IF NOT EXISTS "PortalConnection_targetKind_targetId_status_idx" ON "PortalConnection"("targetKind", "targetId", "status");
CREATE INDEX IF NOT EXISTS "PortalConnection_requesterKind_requesterId_status_idx" ON "PortalConnection"("requesterKind", "requesterId", "status");

CREATE TABLE IF NOT EXISTS "PortalConnectionEvent" (
  "id" TEXT PRIMARY KEY,
  "connectionId" TEXT NOT NULL REFERENCES "PortalConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "side" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "shares" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PortalConnectionEvent_connectionId_createdAt_idx" ON "PortalConnectionEvent"("connectionId", "createdAt");

-- Supabase exposes public tables over its REST API: keep these closed to it, as the other tables are.
ALTER TABLE "PortalConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalConnectionEvent" ENABLE ROW LEVEL SECURITY;
