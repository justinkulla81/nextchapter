-- One source of truth for the pivot target (src/lib/journey/pivot-target.ts): targetFunction is the truth,
-- and "isPivoting" is its mirror: true when the member has a target different from their own function, or is
-- on the Changing careers journey. Readers in the app already compute this, so this is only to make the
-- stored flag agree for older code and for reporting.
-- Data only, no schema change, nothing deleted. NOT applied. Safe to run twice. Preview first:
--   SELECT count(*) FROM "CandidateProfile" WHERE "isPivoting" IS DISTINCT FROM (
--     ("targetFunction" IS NOT NULL AND btrim("targetFunction") <> '' AND lower(btrim("targetFunction")) IS DISTINCT FROM lower(btrim(coalesce("primaryFunction", ''))))
--     OR "journey" = 'CAREER_CHANGE');

UPDATE "CandidateProfile"
SET "isPivoting" = (
  ("targetFunction" IS NOT NULL AND btrim("targetFunction") <> '' AND lower(btrim("targetFunction")) IS DISTINCT FROM lower(btrim(coalesce("primaryFunction", ''))))
  OR "journey" = 'CAREER_CHANGE'
)
WHERE "isPivoting" IS DISTINCT FROM (
  ("targetFunction" IS NOT NULL AND btrim("targetFunction") <> '' AND lower(btrim("targetFunction")) IS DISTINCT FROM lower(btrim(coalesce("primaryFunction", ''))))
  OR "journey" = 'CAREER_CHANGE'
);
