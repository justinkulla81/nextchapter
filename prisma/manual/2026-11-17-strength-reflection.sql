-- Find your strengths: one row per member per area (src/lib/strengths-interview/). Additive.
CREATE TABLE IF NOT EXISTS "StrengthReflection" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "answers" JSONB NOT NULL DEFAULT '[]',
  "strength" TEXT,
  "proof" TEXT,
  "watchOut" TEXT,
  "sayIt" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StrengthReflection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StrengthReflection_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StrengthReflection_candidateId_area_key" ON "StrengthReflection"("candidateId", "area");
ALTER TABLE "StrengthReflection" ENABLE ROW LEVEL SECURITY;
