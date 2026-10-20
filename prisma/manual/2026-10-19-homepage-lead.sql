-- Homepage lead capture: the journey picker and saved job searches.
-- Additive, re-runnable. RUN BEFORE the deploy that reads it (the signup forms fail soft until then).
CREATE TABLE IF NOT EXISTS "HomepageLead" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "situation" TEXT NOT NULL DEFAULT '',
  "followup" TEXT NOT NULL DEFAULT '',
  "searchQ" TEXT NOT NULL DEFAULT '',
  "searchLoc" TEXT NOT NULL DEFAULT '',
  "searchRemote" BOOLEAN NOT NULL DEFAULT false,
  "unsubscribeToken" TEXT NOT NULL,
  "ip" TEXT,
  "planSentAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomepageLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HomepageLead_unsubscribeToken_key" ON "HomepageLead"("unsubscribeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "HomepageLead_email_kind_situation_searchQ_searchLoc_searchRemote_key" ON "HomepageLead"("email", "kind", "situation", "searchQ", "searchLoc", "searchRemote");
CREATE INDEX IF NOT EXISTS "HomepageLead_ip_createdAt_idx" ON "HomepageLead"("ip", "createdAt");
CREATE INDEX IF NOT EXISTS "HomepageLead_kind_createdAt_idx" ON "HomepageLead"("kind", "createdAt");
