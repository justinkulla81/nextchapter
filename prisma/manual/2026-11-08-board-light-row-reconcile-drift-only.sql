-- board_light_row_reconcile (the nightly board-light-rows cron, src/lib/jobs/board-light-rows.ts): write only rows that differ.
-- The old body did INSERT ... SELECT * FROM the whole 20,000-row id page ... ON CONFLICT DO UPDATE ... WHERE <differs>. Postgres locks the
-- existing row of every conflict BEFORE it evaluates that WHERE, so every page locked ~20,000 BoardLightRow rows in id order even when
-- nothing changed. Imports (one UPDATE per URL, and their sync trigger writes BoardLightRow rows) lock the same rows in another order:
-- deadlocks on 2026-11-01 and 2026-11-06 (40P01), and long lock waits. The new body selects only the rows that differ or are missing, so
-- an in-step page locks nothing (dry run on the first page of 64: 0 drifted rows, reads only), and a write blocked behind an import gives up
-- after 5 s (lock_timeout) so the caller can skip that page and carry on.
-- Same signature and result as before; replaces the function in place. NOT YET APPLIED to production: the Supabase confirmation prompt went unanswered on 2026-11-08; update this line once it has been run.
-- ROLLBACK: run the old definition below.

CREATE OR REPLACE FUNCTION public.board_light_row_reconcile(lo text, hi text)
 RETURNS TABLE(upserted integer, deleted integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE u integer; d integer;
BEGIN
  -- A write blocked behind an import gives up after 5 s (the caller skips that page; the next night repairs it) instead of waiting.
  PERFORM set_config('lock_timeout', '5s', true);
  -- Only rows that differ (or are missing) are written, so no lock is taken on the thousands of rows that are already right.
  INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy","targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax","createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags")
    SELECT s."id",s."title",s."companyName",s."audienceTier",s."source",s."targetFunction",s."targetLevel",s."targetRemotePolicy",s."targetLocation",s."location",s."level",s."sourceCategory",s."postedAt",s."sourceCount",s."salaryMin",s."salaryMax",s."createdAt",s."employmentType",s."status",s."archivedAt",s."institutionScopeId",s."distribution",s."expiresAt",s."employerSector",s."requirementTags"
    FROM "ExclusiveJobPosting" s
    LEFT JOIN "BoardLightRow" cur ON cur."id" = s."id"
    WHERE s."id" >= lo AND (hi IS NULL OR s."id" < hi)
      AND (cur."id" IS NULL OR (cur."title",cur."companyName",cur."audienceTier",cur."source",cur."targetFunction",cur."targetLevel",cur."targetRemotePolicy",cur."targetLocation",cur."location",cur."level",cur."sourceCategory",cur."postedAt",cur."sourceCount",cur."salaryMin",cur."salaryMax",cur."createdAt",cur."employmentType",cur."status",cur."archivedAt",cur."institutionScopeId",cur."distribution",cur."expiresAt",cur."employerSector",cur."requirementTags") IS DISTINCT FROM (s."title",s."companyName",s."audienceTier",s."source",s."targetFunction",s."targetLevel",s."targetRemotePolicy",s."targetLocation",s."location",s."level",s."sourceCategory",s."postedAt",s."sourceCount",s."salaryMin",s."salaryMax",s."createdAt",s."employmentType",s."status",s."archivedAt",s."institutionScopeId",s."distribution",s."expiresAt",s."employerSector",s."requirementTags"))
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "companyName" = EXCLUDED."companyName",
      "audienceTier" = EXCLUDED."audienceTier",
      "source" = EXCLUDED."source",
      "targetFunction" = EXCLUDED."targetFunction",
      "targetLevel" = EXCLUDED."targetLevel",
      "targetRemotePolicy" = EXCLUDED."targetRemotePolicy",
      "targetLocation" = EXCLUDED."targetLocation",
      "location" = EXCLUDED."location",
      "level" = EXCLUDED."level",
      "sourceCategory" = EXCLUDED."sourceCategory",
      "postedAt" = EXCLUDED."postedAt",
      "sourceCount" = EXCLUDED."sourceCount",
      "salaryMin" = EXCLUDED."salaryMin",
      "salaryMax" = EXCLUDED."salaryMax",
      "createdAt" = EXCLUDED."createdAt",
      "employmentType" = EXCLUDED."employmentType",
      "status" = EXCLUDED."status",
      "archivedAt" = EXCLUDED."archivedAt",
      "institutionScopeId" = EXCLUDED."institutionScopeId",
      "distribution" = EXCLUDED."distribution",
      "expiresAt" = EXCLUDED."expiresAt",
      "employerSector" = EXCLUDED."employerSector",
      "requirementTags" = EXCLUDED."requirementTags"
    WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",b."institutionScopeId",b."distribution",b."expiresAt",b."employerSector",b."requirementTags") IS DISTINCT FROM (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt",EXCLUDED."employerSector",EXCLUDED."requirementTags");
  GET DIAGNOSTICS u = ROW_COUNT;
  DELETE FROM "BoardLightRow" b
  WHERE b."id" >= lo AND (hi IS NULL OR b."id" < hi)
    AND NOT EXISTS (SELECT 1 FROM "ExclusiveJobPosting" e WHERE e."id" = b."id");
  GET DIAGNOSTICS d = ROW_COUNT;
  RETURN QUERY SELECT u, d;
END $function$;

-- ---- OLD DEFINITION (rollback) ----
-- CREATE OR REPLACE FUNCTION public.board_light_row_reconcile(lo text, hi text)
--  RETURNS TABLE(upserted integer, deleted integer)
--  LANGUAGE plpgsql
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE u integer; d integer;
-- BEGIN
--   INSERT INTO "BoardLightRow" AS b ("id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy","targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax","createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags")
--     SELECT "id","title","companyName","audienceTier","source","targetFunction","targetLevel","targetRemotePolicy","targetLocation","location","level","sourceCategory","postedAt","sourceCount","salaryMin","salaryMax","createdAt","employmentType","status","archivedAt","institutionScopeId","distribution","expiresAt","employerSector","requirementTags"
--     FROM (SELECT * FROM "ExclusiveJobPosting" WHERE "id" >= lo AND (hi IS NULL OR "id" < hi)) src
--     ON CONFLICT ("id") DO UPDATE SET
--       "title" = EXCLUDED."title",
--       "companyName" = EXCLUDED."companyName",
--       "audienceTier" = EXCLUDED."audienceTier",
--       "source" = EXCLUDED."source",
--       "targetFunction" = EXCLUDED."targetFunction",
--       "targetLevel" = EXCLUDED."targetLevel",
--       "targetRemotePolicy" = EXCLUDED."targetRemotePolicy",
--       "targetLocation" = EXCLUDED."targetLocation",
--       "location" = EXCLUDED."location",
--       "level" = EXCLUDED."level",
--       "sourceCategory" = EXCLUDED."sourceCategory",
--       "postedAt" = EXCLUDED."postedAt",
--       "sourceCount" = EXCLUDED."sourceCount",
--       "salaryMin" = EXCLUDED."salaryMin",
--       "salaryMax" = EXCLUDED."salaryMax",
--       "createdAt" = EXCLUDED."createdAt",
--       "employmentType" = EXCLUDED."employmentType",
--       "status" = EXCLUDED."status",
--       "archivedAt" = EXCLUDED."archivedAt",
--       "institutionScopeId" = EXCLUDED."institutionScopeId",
--       "distribution" = EXCLUDED."distribution",
--       "expiresAt" = EXCLUDED."expiresAt",
--       "employerSector" = EXCLUDED."employerSector",
--       "requirementTags" = EXCLUDED."requirementTags"
--     WHERE (b."title",b."companyName",b."audienceTier",b."source",b."targetFunction",b."targetLevel",b."targetRemotePolicy",b."targetLocation",b."location",b."level",b."sourceCategory",b."postedAt",b."sourceCount",b."salaryMin",b."salaryMax",b."createdAt",b."employmentType",b."status",b."archivedAt",b."institutionScopeId",b."distribution",b."expiresAt",b."employerSector",b."requirementTags") IS DISTINCT FROM (EXCLUDED."title",EXCLUDED."companyName",EXCLUDED."audienceTier",EXCLUDED."source",EXCLUDED."targetFunction",EXCLUDED."targetLevel",EXCLUDED."targetRemotePolicy",EXCLUDED."targetLocation",EXCLUDED."location",EXCLUDED."level",EXCLUDED."sourceCategory",EXCLUDED."postedAt",EXCLUDED."sourceCount",EXCLUDED."salaryMin",EXCLUDED."salaryMax",EXCLUDED."createdAt",EXCLUDED."employmentType",EXCLUDED."status",EXCLUDED."archivedAt",EXCLUDED."institutionScopeId",EXCLUDED."distribution",EXCLUDED."expiresAt",EXCLUDED."employerSector",EXCLUDED."requirementTags");
--   GET DIAGNOSTICS u = ROW_COUNT;
--   DELETE FROM "BoardLightRow" b
--   WHERE b."id" >= lo AND (hi IS NULL OR b."id" < hi)
--     AND NOT EXISTS (SELECT 1 FROM "ExclusiveJobPosting" e WHERE e."id" = b."id");
--   GET DIAGNOSTICS d = ROW_COUNT;
--   RETURN QUERY SELECT u, d;
-- END $function$
