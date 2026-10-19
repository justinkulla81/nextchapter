-- Unlock points: a per-day visit record (the "logged in" signal) and the cycle window points are
-- counted in. Additive (two tables). Apply by hand; never plain `prisma db push` on prod.
-- Until applied the code treats both as empty (reads and writes fail soft): logins earn nothing and
-- the cycle starts at registration, so deploying first is safe.
-- No backfill needed: a member registered before 2026-10-19 gets their first cycle row, starting at
-- their first read after deploy, created by the app (it also records the questions they had already
-- answered so those do not count). That keeps long-time members from unlocking instantly.
CREATE TABLE IF NOT EXISTS "CandidateVisitDay" (
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "day"         TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("candidateId", "day")
);
ALTER TABLE "CandidateVisitDay" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "EffortCycle" (
  "candidateId"      TEXT PRIMARY KEY REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "startedAt"        TIMESTAMP(3) NOT NULL,
  "baselineAnswered" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "EffortCycle" ENABLE ROW LEVEL SECURITY;
