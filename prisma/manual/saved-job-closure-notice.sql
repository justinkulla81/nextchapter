-- One row per (member, saved job that was taken down), so the daily cron tells the owner and the member once. Additive only; safe to re-run.
CREATE TABLE IF NOT EXISTS "SavedJobClosureNotice" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "CandidateProfile"("id") ON DELETE CASCADE,
  "jobId" TEXT NOT NULL,
  "closeReason" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "memberEmailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SavedJobClosureNotice_candidateId_jobId_key" ON "SavedJobClosureNotice"("candidateId", "jobId");
CREATE INDEX IF NOT EXISTS "SavedJobClosureNotice_createdAt_idx" ON "SavedJobClosureNotice"("createdAt");
