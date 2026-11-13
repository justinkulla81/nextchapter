-- NextChapter Talent: the firm's pipeline for each intake candidate (stage, note, next step) and a dated log of stage moves.
-- Additive; safe to re-run.
ALTER TABLE "IntakeConnection" ADD COLUMN IF NOT EXISTS "pipelineStage" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "IntakeConnection" ADD COLUMN IF NOT EXISTS "pipelineNote" TEXT;
ALTER TABLE "IntakeConnection" ADD COLUMN IF NOT EXISTS "nextStepAt" DATE;
ALTER TABLE "IntakeConnection" ADD COLUMN IF NOT EXISTS "pipelineChangedAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "IntakeStageEvent" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "fromStage" TEXT NOT NULL,
  "toStage" TEXT NOT NULL,
  "recruiterId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntakeStageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntakeStageEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntakeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "IntakeStageEvent_connectionId_createdAt_idx" ON "IntakeStageEvent"("connectionId", "createdAt");
