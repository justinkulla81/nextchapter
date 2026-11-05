-- A successful cron run can keep the start of its JSON answer (withCronRun recordResult). Additive.
ALTER TABLE "CronRun" ADD COLUMN IF NOT EXISTS "detail" TEXT;
