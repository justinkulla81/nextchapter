-- Education Hub: a curated catalog of training (universities, third parties, training offered locally incl. NextChapter custom courses),
-- with optional targeting by industry, experience band and function. Additive.
CREATE TABLE IF NOT EXISTS "TrainingOffering" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'THIRD_PARTY',
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "url" TEXT,
  "summary" TEXT,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "functions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hours" INTEGER,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "wioaEligible" BOOLEAN NOT NULL DEFAULT false,
  "ncCustom" BOOLEAN NOT NULL DEFAULT false,
  "programId" TEXT,
  "assignment" TEXT NOT NULL DEFAULT 'LISTED',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainingOffering_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TrainingOffering_institutionId_status_idx" ON "TrainingOffering"("institutionId", "status");
