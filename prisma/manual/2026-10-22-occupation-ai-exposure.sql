-- Anthropic Economic Index "observed exposure" by 6-digit SOC occupation (Labor market impacts of AI, 2026-03-05).
-- Of the tasks an LLM could theoretically speed up, how much already sees automated AI use in professional settings
-- (automated use full weight, augmentative half, weighted by time spent on each task). 0 means no observed use yet,
-- not that the job is safe. Data: https://huggingface.co/datasets/Anthropic/EconomicIndex (labor_market_impacts/job_exposure.csv),
-- released under CC-BY, so every surface that shows it credits "Anthropic Economic Index".
-- Additive and re-runnable. Load with scripts/careers/load-ai-exposure.ts or the generated SQL.
CREATE TABLE IF NOT EXISTS "OccupationAiExposure" (
    "soc6" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "observedExposure" DOUBLE PRECISION NOT NULL,
    "release" TEXT NOT NULL,
    CONSTRAINT "OccupationAiExposure_pkey" PRIMARY KEY ("soc6")
);
ALTER TABLE "OccupationAiExposure" ENABLE ROW LEVEL SECURITY;
