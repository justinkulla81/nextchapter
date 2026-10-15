-- RateLimitHit: backing store for src/lib/security/rate-limit.ts (per-IP and
-- per-recipient limits on the public email-sending forms). Additive only (one
-- new table). Apply by hand; never plain `prisma db push` on prod. Until it is
-- applied the limiter fails open, so deploying the code first is safe.
CREATE TABLE IF NOT EXISTS "RateLimitHit" (
  "id"        TEXT PRIMARY KEY,
  "bucket"    TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RateLimitHit_bucket_key_createdAt_idx" ON "RateLimitHit"("bucket","key","createdAt");
CREATE INDEX IF NOT EXISTS "RateLimitHit_createdAt_idx" ON "RateLimitHit"("createdAt");
ALTER TABLE "RateLimitHit" ENABLE ROW LEVEL SECURITY;
