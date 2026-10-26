-- Precomputed aggregates for the public industry and function pages. Additive only; safe to re-run.
CREATE TABLE IF NOT EXISTS "TopicSnapshot" (
  "key" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
