-- Local job fairs, hiring events and entrepreneurship events (LocalEvent, LocalEventLink, LocalEventSource). Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS "LocalEvent" (
  "id" TEXT PRIMARY KEY,
  "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL,
  "track" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'IN_PERSON',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "city" TEXT,
  "state" TEXT,
  "cityKey" TEXT,
  "countyKey" TEXT,
  "url" TEXT,
  "registerUrl" TEXT,
  "cost" TEXT,
  "proScore" INTEGER NOT NULL DEFAULT 50,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LocalEvent_dedupeKey_key" ON "LocalEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "LocalEvent_state_startsAt_idx" ON "LocalEvent"("state","startsAt");
CREATE INDEX IF NOT EXISTS "LocalEvent_cityKey_startsAt_idx" ON "LocalEvent"("cityKey","startsAt");
CREATE INDEX IF NOT EXISTS "LocalEvent_countyKey_startsAt_idx" ON "LocalEvent"("countyKey","startsAt");
CREATE INDEX IF NOT EXISTS "LocalEvent_track_startsAt_idx" ON "LocalEvent"("track","startsAt");

CREATE TABLE IF NOT EXISTS "LocalEventLink" (
  "eventId" TEXT NOT NULL REFERENCES "LocalEvent"("id") ON DELETE CASCADE,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'HOST',
  PRIMARY KEY ("eventId","targetKind","targetId","role")
);
CREATE INDEX IF NOT EXISTS "LocalEventLink_target_idx" ON "LocalEventLink"("targetKind","targetId");

CREATE TABLE IF NOT EXISTS "LocalEventSource" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "city" TEXT,
  "countyKey" TEXT,
  "website" TEXT NOT NULL,
  "eventsUrl" TEXT,
  "feedType" TEXT,
  "checkedAt" TIMESTAMP(3),
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT
);
CREATE INDEX IF NOT EXISTS "LocalEventSource_kind_state_idx" ON "LocalEventSource"("kind","state");
