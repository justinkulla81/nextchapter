-- Mobile app: installed devices (push tokens) and saved searches / employers. Additive; the code is fail-soft until applied.
CREATE TABLE IF NOT EXISTS "MobileDevice" (
  "id" TEXT PRIMARY KEY,
  "pushToken" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MobileDevice_pushToken_key" ON "MobileDevice"("pushToken");
CREATE INDEX IF NOT EXISTS "MobileDevice_userId_idx" ON "MobileDevice"("userId");

CREATE TABLE IF NOT EXISTS "MobileSavedSearch" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "q" TEXT NOT NULL DEFAULT '',
  "loc" TEXT NOT NULL DEFAULT '',
  "remote" BOOLEAN NOT NULL DEFAULT false,
  "minPay" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastPushedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "MobileSavedSearch_userId_kind_q_loc_remote_minPay_key" ON "MobileSavedSearch"("userId","kind","q","loc","remote","minPay");
CREATE INDEX IF NOT EXISTS "MobileSavedSearch_userId_idx" ON "MobileSavedSearch"("userId");
