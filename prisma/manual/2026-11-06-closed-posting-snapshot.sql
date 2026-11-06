-- Closed-postings map: a nightly snapshot of how many times each company + title + location has been posted and closed.
-- Additive. src/lib/jobs/ghost-risk-data.ts, rebuilt by cron /api/cron/board-light-rows. Readers fall back to grouping the
-- closed postings themselves (slow on a cold server instance) until the first snapshot exists, so this can be applied before the deploy.
CREATE TABLE IF NOT EXISTS "ClosedPostingSnapshot" (
  "id" TEXT PRIMARY KEY,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "data" JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "ClosedPostingSnapshot_computedAt_idx" ON "ClosedPostingSnapshot"("computedAt");
