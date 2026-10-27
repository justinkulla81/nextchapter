-- Company events read from SEC filings (acquisitions, executive changes, capital raised). Additive only; safe to re-run.
CREATE TABLE IF NOT EXISTS "CompanyEvent" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "accession" TEXT NOT NULL,
  "filerName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyEvent_accession_kind_key" ON "CompanyEvent"("accession", "kind");
CREATE INDEX IF NOT EXISTS "CompanyEvent_companyId_eventDate_idx" ON "CompanyEvent"("companyId", "eventDate");
CREATE INDEX IF NOT EXISTS "CompanyEvent_eventDate_idx" ON "CompanyEvent"("eventDate");
