-- Paid spend by ad channel ('google' | 'linkedin' | 'reddit' | 'facebook' | 'bing'). Rows entered before this existed were Google Ads.
-- Adds a column and widens the primary key to (day, channel, segment); no rows are changed or removed. Safe to re-run.
-- Apply before deploying the code that reads it.
ALTER TABLE "SemSpend" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'google';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage
    WHERE table_name = 'SemSpend' AND constraint_name = 'SemSpend_pkey' AND column_name = 'channel'
  ) THEN
    ALTER TABLE "SemSpend" DROP CONSTRAINT "SemSpend_pkey";
    ALTER TABLE "SemSpend" ADD CONSTRAINT "SemSpend_pkey" PRIMARY KEY ("day", "channel", "segment");
  END IF;
END $$;
