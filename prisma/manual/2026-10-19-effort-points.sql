-- Unlock points: a per-day visit record (the "logged in" signal) and the cycle window points are
-- counted in. Additive (one enum, two tables). Apply by hand; never plain `prisma db push` on prod.
-- Until applied the code treats both as empty (reads and writes fail soft): logins earn nothing and
-- the cycle starts at registration, so deploying first is safe.
DO $$ BEGIN
  CREATE TYPE "EffortCycleKind" AS ENUM ('STRATEGY', 'REPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CandidateVisitDay" (
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "day"         TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("candidateId", "day")
);
ALTER TABLE "CandidateVisitDay" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "EffortCycle" (
  "id"               TEXT PRIMARY KEY,
  "candidateId"      TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "kind"             "EffortCycleKind" NOT NULL,
  "startedAt"        TIMESTAMP(3) NOT NULL,
  "baselineAnswered" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EffortCycle_candidateId_kind_key" ON "EffortCycle"("candidateId","kind");
ALTER TABLE "EffortCycle" ENABLE ROW LEVEL SECURITY;
