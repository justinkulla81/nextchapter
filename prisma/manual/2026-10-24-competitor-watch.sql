-- Competitor watch (monthly refresh, weekly news, proposed matrix cells). Additive only; apply by hand, never prisma db push.
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "watchRefreshedAt" TIMESTAMP(3);
ALTER TABLE "ProductCompetitor" ADD COLUMN IF NOT EXISTS "watchNewsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CompetitorWatchSetting" (
  "id" TEXT PRIMARY KEY DEFAULT 'singleton',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "refreshEnabled" BOOLEAN NOT NULL DEFAULT true,
  "newsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "monthlyCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedByEmail" TEXT
);
INSERT INTO "CompetitorWatchSetting" ("id") VALUES ('singleton') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "CompetitorWatchRun" (
  "id" TEXT PRIMARY KEY,
  "competitorId" TEXT,
  "kind" TEXT NOT NULL,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "searches" INTEGER NOT NULL DEFAULT 0,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CompetitorWatchRun_createdAt_idx" ON "CompetitorWatchRun"("createdAt");
CREATE INDEX IF NOT EXISTS "CompetitorWatchRun_competitorId_kind_createdAt_idx" ON "CompetitorWatchRun"("competitorId","kind","createdAt");

CREATE TABLE IF NOT EXISTS "CompetitorEvent" (
  "id" TEXT PRIMARY KEY,
  "competitorId" TEXT NOT NULL REFERENCES "ProductCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "url" TEXT,
  "amountUsd" DOUBLE PRECISION,
  "occurredAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'news',
  "dedupeKey" TEXT NOT NULL,
  "digestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorEvent_competitorId_dedupeKey_key" ON "CompetitorEvent"("competitorId","dedupeKey");
CREATE INDEX IF NOT EXISTS "CompetitorEvent_digestedAt_createdAt_idx" ON "CompetitorEvent"("digestedAt","createdAt");

CREATE TABLE IF NOT EXISTS "CompetitorCellProposal" (
  "id" TEXT PRIMARY KEY,
  "competitorId" TEXT NOT NULL REFERENCES "ProductCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "capabilityId" TEXT NOT NULL,
  "status" "CompetitorCapabilityStatus" NOT NULL,
  "note" TEXT,
  "evidenceUrl" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorCellProposal_competitorId_capabilityId_state_key" ON "CompetitorCellProposal"("competitorId","capabilityId","state");
CREATE INDEX IF NOT EXISTS "CompetitorCellProposal_state_createdAt_idx" ON "CompetitorCellProposal"("state","createdAt");
