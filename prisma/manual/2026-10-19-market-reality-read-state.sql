-- MarketRealityReadState: the weekly saved read behind the "what changed" note.
-- Additive (one table). Apply by hand; never plain `prisma db push` on prod. Until it is applied
-- the code treats the table as empty (reads and writes fail soft), so deploying first is safe.
CREATE TABLE IF NOT EXISTS "MarketRealityReadState" (
  "id"            TEXT PRIMARY KEY,
  "candidateId"   TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "weekStartDate" TIMESTAMP(3) NOT NULL,
  "state"         JSONB NOT NULL,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketRealityReadState_candidateId_weekStartDate_key" ON "MarketRealityReadState"("candidateId","weekStartDate");
CREATE INDEX IF NOT EXISTS "MarketRealityReadState_candidateId_weekStartDate_idx" ON "MarketRealityReadState"("candidateId","weekStartDate");
ALTER TABLE "MarketRealityReadState" ENABLE ROW LEVEL SECURITY;
