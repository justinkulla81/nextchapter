-- Board light rows: a narrow copy of ExclusiveJobPosting's light columns
-- (everything the board ranks on, no description) plus the columns the board
-- filters on. Every board render on a cold server instance read all ~160k
-- live postings from the wide table, which took 11-15 s; this table holds the
-- same rows at a fraction of the width. See src/lib/jobs/board-light-rows.ts.
--
-- Kept in step by statement-level triggers on ExclusiveJobPosting (one
-- set-based write per INSERT / UPDATE / DELETE statement, never per row, and
-- only rows whose copied columns changed are rewritten), so it is never stale:
-- the board reads exactly what the wide table holds. A nightly cron and every
-- import finalize also run board_light_row_reconcile() over id ranges, which
-- repairs any drift (there should be none) and reports it. If the table or a
-- trigger is missing or disabled, the app reads the wide table as before.
--
-- Additive only: one new table, three triggers, three functions. The initial
-- fill is the same reconcile, run in id-ordered pages. Apply by hand; never
-- plain `prisma db push` on prod.

CREATE TABLE IF NOT EXISTS "BoardLightRow" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "audienceTier" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "targetFunction" TEXT,
  "targetLevel" TEXT,
  "targetRemotePolicy" TEXT,
  "targetLocation" TEXT,
  "location" TEXT,
  "level" TEXT,
  "sourceCategory" TEXT,
  "postedAt" TIMESTAMP(3),
  "sourceCount" INTEGER,
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "employmentType" TEXT,
  "status" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "institutionScopeId" TEXT,
  "distribution" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3)
);
ALTER TABLE "BoardLightRow" ENABLE ROW LEVEL SECURITY;

-- The transition table is only visible inside the trigger function itself, so
-- each function carries its own copy of the upsert. SECURITY DEFINER so a
-- write by any role allowed to write ExclusiveJobPosting also lands here
-- (BoardLightRow has RLS on and no policies: only the owner reads it).
CREATE OR REPLACE FUNCTION board_light_row_after_upsert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt")
    SELECT "id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt"
    FROM board_light_new
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title","companyName" = EXCLUDED."companyName",
      "audienceTier" = EXCLUDED."audienceTier","source" = EXCLUDED."source",
      "targetFunction" = EXCLUDED."targetFunction","targetLevel" = EXCLUDED."targetLevel",
      "targetRemotePolicy" = EXCLUDED."targetRemotePolicy","targetLocation" = EXCLUDED."targetLocation",
      "location" = EXCLUDED."location","level" = EXCLUDED."level",
      "sourceCategory" = EXCLUDED."sourceCategory","postedAt" = EXCLUDED."postedAt",
      "sourceCount" = EXCLUDED."sourceCount","salaryMin" = EXCLUDED."salaryMin",
      "salaryMax" = EXCLUDED."salaryMax","createdAt" = EXCLUDED."createdAt",
      "employmentType" = EXCLUDED."employmentType","status" = EXCLUDED."status",
      "archivedAt" = EXCLUDED."archivedAt","institutionScopeId" = EXCLUDED."institutionScopeId",
      "distribution" = EXCLUDED."distribution","expiresAt" = EXCLUDED."expiresAt"
    WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",
      b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",
      b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",
      b."institutionScopeId",b."distribution",b."expiresAt")
      IS DISTINCT FROM
      (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",
      EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",
      EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",
      EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",
      EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt");
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION board_light_row_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM "BoardLightRow" b USING board_light_old o WHERE b."id" = o."id";
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS "BoardLightRow_sync_insert" ON "ExclusiveJobPosting";
DROP TRIGGER IF EXISTS "BoardLightRow_sync_update" ON "ExclusiveJobPosting";
DROP TRIGGER IF EXISTS "BoardLightRow_sync_delete" ON "ExclusiveJobPosting";
CREATE TRIGGER "BoardLightRow_sync_insert" AFTER INSERT ON "ExclusiveJobPosting"
  REFERENCING NEW TABLE AS board_light_new FOR EACH STATEMENT EXECUTE FUNCTION board_light_row_after_upsert();
-- Ids never change (cuid primary key); a row left behind by one that did is
-- removed by the reconcile.
CREATE TRIGGER "BoardLightRow_sync_update" AFTER UPDATE ON "ExclusiveJobPosting"
  REFERENCING NEW TABLE AS board_light_new FOR EACH STATEMENT EXECUTE FUNCTION board_light_row_after_upsert();
CREATE TRIGGER "BoardLightRow_sync_delete" AFTER DELETE ON "ExclusiveJobPosting"
  REFERENCING OLD TABLE AS board_light_old FOR EACH STATEMENT EXECUTE FUNCTION board_light_row_after_delete();

-- Repairs one id range [lo, hi) (hi NULL = to the end): copies rows that are
-- missing or differ, removes rows whose posting is gone. Returns how many rows
-- it had to write — the drift, which is 0 while the triggers are on. Also the
-- initial fill.
CREATE OR REPLACE FUNCTION board_light_row_reconcile(lo text, hi text)
RETURNS TABLE(upserted integer, deleted integer)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE u integer; d integer;
BEGIN
  INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt")
    SELECT "id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt"
    FROM (SELECT * FROM "ExclusiveJobPosting" WHERE "id" >= lo AND (hi IS NULL OR "id" < hi)) src
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title","companyName" = EXCLUDED."companyName",
      "audienceTier" = EXCLUDED."audienceTier","source" = EXCLUDED."source",
      "targetFunction" = EXCLUDED."targetFunction","targetLevel" = EXCLUDED."targetLevel",
      "targetRemotePolicy" = EXCLUDED."targetRemotePolicy","targetLocation" = EXCLUDED."targetLocation",
      "location" = EXCLUDED."location","level" = EXCLUDED."level",
      "sourceCategory" = EXCLUDED."sourceCategory","postedAt" = EXCLUDED."postedAt",
      "sourceCount" = EXCLUDED."sourceCount","salaryMin" = EXCLUDED."salaryMin",
      "salaryMax" = EXCLUDED."salaryMax","createdAt" = EXCLUDED."createdAt",
      "employmentType" = EXCLUDED."employmentType","status" = EXCLUDED."status",
      "archivedAt" = EXCLUDED."archivedAt","institutionScopeId" = EXCLUDED."institutionScopeId",
      "distribution" = EXCLUDED."distribution","expiresAt" = EXCLUDED."expiresAt"
    WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",
      b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",
      b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",
      b."institutionScopeId",b."distribution",b."expiresAt")
      IS DISTINCT FROM
      (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",
      EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",
      EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",
      EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",
      EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt");
  GET DIAGNOSTICS u = ROW_COUNT;
  DELETE FROM "BoardLightRow" b
  WHERE b."id" >= lo AND (hi IS NULL OR b."id" < hi)
    AND NOT EXISTS (SELECT 1 FROM "ExclusiveJobPosting" e WHERE e."id" = b."id");
  GET DIAGNOSTICS d = ROW_COUNT;
  RETURN QUERY SELECT u, d;
END $$;

REVOKE EXECUTE ON FUNCTION board_light_row_reconcile(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION board_light_row_after_upsert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION board_light_row_after_delete() FROM PUBLIC, anon, authenticated;
