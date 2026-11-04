-- A search firm's brand color, read from its own website (src/lib/firms/brand-color.ts). color is null when the site gave none.
-- Additive only; safe to re-run. Apply before deploying the code that reads it.
CREATE TABLE IF NOT EXISTS "FirmBrandColor" (
  "orgId" TEXT PRIMARY KEY,
  "color" TEXT,
  "source" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
