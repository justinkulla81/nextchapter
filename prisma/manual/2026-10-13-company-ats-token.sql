-- Public job-board token for a company, found by probing Greenhouse/Lever/Ashby
-- (src/lib/market/ats-discovery.ts), plus the time it was last probed so a miss is
-- not retried every run. Additive and re-runnable: two nullable columns.
--
-- RUN BEFORE the deploy that reads it (Prisma selects every scalar column).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "atsToken" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "atsCheckedAt" TIMESTAMP(3);
