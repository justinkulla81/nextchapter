-- Adzuna labor-market statistics cache + global API request budget. Additive.
CREATE TABLE "AdzunaInsightCache" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "payload" JSONB,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "refreshAfter" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdzunaInsightCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdzunaInsightCache_endpoint_queryKey_location_key" ON "AdzunaInsightCache"("endpoint", "queryKey", "location");
CREATE INDEX "AdzunaInsightCache_lastHitAt_idx" ON "AdzunaInsightCache"("lastHitAt");
ALTER TABLE "AdzunaInsightCache" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "AdzunaApiUsage" (
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdzunaApiUsage_pkey" PRIMARY KEY ("bucket")
);
ALTER TABLE "AdzunaApiUsage" ENABLE ROW LEVEL SECURITY;
