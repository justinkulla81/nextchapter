-- Cache of Claude Haiku reads of 8-K Item 5.02 sections (one per accession number). Additive.
CREATE TABLE IF NOT EXISTS "SecFilingRead" (
    "accessionNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecFilingRead_pkey" PRIMARY KEY ("accessionNumber")
);
ALTER TABLE "SecFilingRead" ENABLE ROW LEVEL SECURITY;
