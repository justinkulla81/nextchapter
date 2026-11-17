-- Virginia boards list independent cities by bare name ("alexandria"); the county tables key them "alexandriacity". Rewritten where
-- the bare name is not a county and the city key is (12 boards). The board import does the same from now on (boardCountyKeyFor).
-- Applied 2026-11-17.
WITH keys AS (SELECT replace(lower("nameKey"),' ','') k FROM "CountyLabor" WHERE state='VA'),
fixed AS (
  SELECT b.id, b.counties AS old,
    ARRAY(SELECT CASE WHEN t NOT IN (SELECT k FROM keys) AND (t || 'city') IN (SELECT k FROM keys) THEN t || 'city' ELSE t END
          FROM unnest(b.counties) WITH ORDINALITY AS u(t, n) ORDER BY n) AS new
  FROM "WorkforceBoard" b WHERE b.state = 'VA')
UPDATE "WorkforceBoard" w SET counties = f.new FROM fixed f WHERE w.id = f.id AND f.new <> f.old;
