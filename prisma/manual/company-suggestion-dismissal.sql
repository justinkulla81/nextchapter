-- "Not for me" on a suggested company on the What you follow page. One row per member and company. Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "CompanySuggestionDismissal" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanySuggestionDismissal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanySuggestionDismissal_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySuggestionDismissal_candidateId_companyId_key" ON "CompanySuggestionDismissal"("candidateId", "companyId");
