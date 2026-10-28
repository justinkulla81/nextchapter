-- AI visibility tables (AiCrawlerHit, AiCitationRun, AiCitationResult). Additive. Apply once with:
--   npx prisma db execute --file prisma/sql/ai-visibility.sql --schema prisma/schema.prisma

CREATE TABLE "AiCrawlerHit" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "bot" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCrawlerHit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiCrawlerHit_day_bot_path_key" ON "AiCrawlerHit"("day", "bot", "path");
CREATE INDEX "AiCrawlerHit_day_idx" ON "AiCrawlerHit"("day");

CREATE TABLE "AiCitationRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "estCostUsd" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "skippedForCap" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AiCitationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiCitationRun_startedAt_idx" ON "AiCitationRun"("startedAt");

CREATE TABLE "AiCitationResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cited" BOOLEAN NOT NULL,
    "mentioned" BOOLEAN NOT NULL,
    "ourUrls" TEXT[],
    "citedDomains" TEXT[],
    "snippet" TEXT,
    "error" TEXT,
    "estCostUsd" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCitationResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiCitationResult_runId_idx" ON "AiCitationResult"("runId");
CREATE INDEX "AiCitationResult_provider_createdAt_idx" ON "AiCitationResult"("provider", "createdAt");
ALTER TABLE "AiCitationResult" ADD CONSTRAINT "AiCitationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiCitationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
