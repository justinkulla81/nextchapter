-- Open roles per city for a function, and for a function in one industry, per career stage.
-- Rebuilt nightly by the market-size cron (src/lib/market/market-size-stats.ts, city-stats.ts).
-- Read by the "Widen your search" page. Additive.
CREATE TABLE IF NOT EXISTS "MarketCityStat" (
  "kind"       TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "band"       TEXT NOT NULL,
  "city"       TEXT NOT NULL,
  "state"      TEXT NOT NULL,
  "openNow"    INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketCityStat_pkey" PRIMARY KEY ("kind", "key", "band", "city")
);
ALTER TABLE "MarketCityStat" ENABLE ROW LEVEL SECURITY;
