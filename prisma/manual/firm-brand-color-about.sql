-- What a firm's own site says about it, shown on its public page. Additive only; safe to re-run.
ALTER TABLE "FirmBrandColor" ADD COLUMN IF NOT EXISTS "about" TEXT;
