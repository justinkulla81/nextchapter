-- Board: job function, employer sector and hard-requirement flags (2026-10-16).
--
-- ExclusiveJobPosting gets the employer sector (private / government / nonprofit /
-- academia) and the requirement flags the crawler reads from the full posting text
-- (clearance, US citizens only, no sponsorship, licenses, travel %, relocation,
-- onsite): the JSON list with labels and evidence, plus a compact tag string the
-- board filters on. The function goes in the existing targetFunction column.
-- BoardLightRow carries employerSector and requirementTags too, so the board's
-- sector / hide-blockers / cleared-jobs filters stay on the fast in-memory path:
-- the sync trigger function and the reconcile are re-created with the two extra
-- columns (bodies otherwise unchanged from prisma/manual/2026-10-14-board-light-row.sql).
--
-- CandidateProfile gets the member side: clearance held (level, active or lapsed,
-- polygraph), licenses held, the most travel they will take, and the employer
-- sectors they turned off. Rows that said yes to travel move to "up to 50%".
--
-- Additive only: nullable columns and constant defaults (metadata-only on Postgres),
-- no index (the board filters these in memory). Apply by hand before deploying the
-- code; never plain `prisma db push` on prod.

ALTER TABLE "ExclusiveJobPosting"
  ADD COLUMN IF NOT EXISTS "employerSector" TEXT,
  ADD COLUMN IF NOT EXISTS "requirementFlags" JSONB,
  ADD COLUMN IF NOT EXISTS "requirementTags" TEXT;

ALTER TABLE "BoardLightRow"
  ADD COLUMN IF NOT EXISTS "employerSector" TEXT,
  ADD COLUMN IF NOT EXISTS "requirementTags" TEXT;

ALTER TABLE "CandidateProfile"
  ADD COLUMN IF NOT EXISTS "maxTravelPct" INTEGER,
  ADD COLUMN IF NOT EXISTS "hiddenEmployerSectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "clearanceLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "clearanceActive" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "clearancePolygraph" TEXT,
  ADD COLUMN IF NOT EXISTS "licensesHeld" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "licensesAnsweredAt" TIMESTAMP(3);

-- travelWillingness was a yes/no: a yes becomes "up to 50%"; a no stays unasked
-- (the old default was no, so it can't tell "no" from "never answered").
UPDATE "CandidateProfile" SET "maxTravelPct" = 50 WHERE "travelWillingness" = true AND "maxTravelPct" IS NULL;

CREATE OR REPLACE FUNCTION board_light_row_after_upsert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags")
    SELECT "id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags"
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
      "distribution" = EXCLUDED."distribution","expiresAt" = EXCLUDED."expiresAt",
      "employerSector" = EXCLUDED."employerSector","requirementTags" = EXCLUDED."requirementTags"
    WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",
      b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",
      b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",
      b."institutionScopeId",b."distribution",b."expiresAt",b."employerSector",b."requirementTags")
      IS DISTINCT FROM
      (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",
      EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",
      EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",
      EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",
      EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt",EXCLUDED."employerSector",EXCLUDED."requirementTags");
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION board_light_row_reconcile(lo text, hi text)
RETURNS TABLE(upserted integer, deleted integer)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE u integer; d integer;
BEGIN
  INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags")
    SELECT "id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy",
      "targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax",
      "createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags"
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
      "distribution" = EXCLUDED."distribution","expiresAt" = EXCLUDED."expiresAt",
      "employerSector" = EXCLUDED."employerSector","requirementTags" = EXCLUDED."requirementTags"
    WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",
      b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",
      b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",
      b."institutionScopeId",b."distribution",b."expiresAt",b."employerSector",b."requirementTags")
      IS DISTINCT FROM
      (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",
      EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",
      EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",
      EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",
      EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt",EXCLUDED."employerSector",EXCLUDED."requirementTags");
  GET DIAGNOSTICS u = ROW_COUNT;
  DELETE FROM "BoardLightRow" b
  WHERE b."id" >= lo AND (hi IS NULL OR b."id" < hi)
    AND NOT EXISTS (SELECT 1 FROM "ExclusiveJobPosting" e WHERE e."id" = b."id");
  GET DIAGNOSTICS d = ROW_COUNT;
  RETURN QUERY SELECT u, d;
END $$;


REVOKE EXECUTE ON FUNCTION board_light_row_reconcile(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION board_light_row_after_upsert() FROM PUBLIC, anon, authenticated;
