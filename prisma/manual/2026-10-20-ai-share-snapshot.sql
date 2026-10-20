-- AiShareSnapshot: weekly share of live postings that ask for a specific AI skill, by function.
-- Additive (one table). Apply by hand; never plain `prisma db push` on prod. Until it is applied
-- the weekly cron fails (recorded on Job health) and nothing else reads the table, so deploying first is safe.
CREATE TABLE IF NOT EXISTS "AiShareSnapshot" (
  "id"        TEXT PRIMARY KEY,
  "weekOf"    TIMESTAMP(3) NOT NULL,
  "fn"        TEXT NOT NULL,
  "total"     INTEGER NOT NULL,
  "withAi"    INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiShareSnapshot_weekOf_fn_key" ON "AiShareSnapshot"("weekOf","fn");
CREATE INDEX IF NOT EXISTS "AiShareSnapshot_fn_weekOf_idx" ON "AiShareSnapshot"("fn","weekOf");
ALTER TABLE "AiShareSnapshot" ENABLE ROW LEVEL SECURITY;
