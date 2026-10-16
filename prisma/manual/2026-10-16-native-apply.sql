-- Native one-click apply. Additive only (one new table). Apply by hand; never
-- plain `prisma db push` on prod.
CREATE TABLE IF NOT EXISTS "NativeJobApplication" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "postingId" TEXT NOT NULL,
  "jobPostingId" TEXT,
  "partnerType" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "resumeId" TEXT,
  "shared" JSONB NOT NULL,
  "confidentialConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "NativeJobApplication_candidateId_postingId_key" ON "NativeJobApplication"("candidateId","postingId");
CREATE INDEX IF NOT EXISTS "NativeJobApplication_postingId_idx" ON "NativeJobApplication"("postingId");
ALTER TABLE "NativeJobApplication" ENABLE ROW LEVEL SECURITY;
