-- Records the X post an admin sent for a WARN filing from CRM > WARN > Publishing (null = not posted). Additive; safe to re-run.
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "xPostedAt" TIMESTAMP(3);
ALTER TABLE "WarnNotice" ADD COLUMN IF NOT EXISTS "xPostRef" TEXT;
