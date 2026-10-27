-- Whole-board figures computed by the cron /api/cron/board-figures and read by the public pages
-- (top employers, workforce numbers, jobs by AI exposure). Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "BoardFigure" (
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardFigure_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "BoardFigure" ENABLE ROW LEVEL SECURITY;
