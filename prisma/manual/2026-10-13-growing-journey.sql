-- Journeys: a "Growing in my job" journey and an active "Staying put" stage.
-- Additive and re-runnable. RUN BEFORE the deploy that reads it.
-- (ALTER TYPE ... ADD VALUE cannot run inside a transaction block.)
ALTER TYPE "JourneyType" ADD VALUE IF NOT EXISTS 'GROWING';
ALTER TYPE "JourneyStage" ADD VALUE IF NOT EXISTS 'STAYING';
