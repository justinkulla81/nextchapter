-- Weekly outreach targets (CRM > Outreach tests). Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "CrmOutreachQuota" (
  "id" TEXT NOT NULL,
  "groupKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "weeklyTarget" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedByEmail" TEXT,
  CONSTRAINT "CrmOutreachQuota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmOutreachQuota_groupKey_channel_key" ON "CrmOutreachQuota"("groupKey", "channel");
