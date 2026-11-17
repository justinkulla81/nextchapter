-- normalizeOrgName and orgNamesMatch (src/lib/text/org-name-match.ts) in SQL, so a member's contacts can be matched to employers
-- inside the database instead of reading every contact (one member has ~20k) to match a handful of companies
-- (src/lib/network/contacts-at-companies.ts; 2026-11-17 egress alert). Checked against the TypeScript on 2,502 production names:
-- identical. Keep the suffix list and its order in step with CORPORATE_SUFFIXES. Additive: two functions.

CREATE OR REPLACE FUNCTION nc_org_norm(name text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$
  WITH a AS (
    SELECT btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(name, '')), '[.,''’]', '', 'g'), '[^a-z0-9[:space:]&]', ' ', 'g'), '[[:space:]]+', ' ', 'g')) AS s
  ), b AS (
    SELECT CASE WHEN s LIKE 'the %' THEN substr(s, 5) ELSE s END AS s FROM a
  )
  SELECT btrim(CASE
    WHEN s LIKE '% incorporated' THEN left(s, -13)
    WHEN s LIKE '% inc' THEN left(s, -4)
    WHEN s LIKE '% llc' THEN left(s, -4)
    WHEN s LIKE '% l l c' THEN left(s, -6)
    WHEN s LIKE '% ltd' THEN left(s, -4)
    WHEN s LIKE '% limited' THEN left(s, -8)
    WHEN s LIKE '% corporation' THEN left(s, -12)
    WHEN s LIKE '% corp' THEN left(s, -5)
    WHEN s LIKE '% company' THEN left(s, -8)
    WHEN s LIKE '% co' THEN left(s, -3)
    WHEN s LIKE '% plc' THEN left(s, -4)
    WHEN s LIKE '% gmbh' THEN left(s, -5)
    WHEN s LIKE '% sa' THEN left(s, -3)
    WHEN s LIKE '% nv' THEN left(s, -3)
    WHEN s LIKE '% ag' THEN left(s, -3)
    ELSE s END) FROM b
$fn$;

-- orgNamesMatch on two already-normalized names: equal; equal with spaces removed (4+ characters); or one contains the other (both 4+).
CREATE OR REPLACE FUNCTION nc_org_norms_match(a text, b text) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$
  SELECT a <> '' AND b <> '' AND (
    a = b
    OR (length(replace(a, ' ', '')) >= 4 AND replace(a, ' ', '') = replace(b, ' ', ''))
    OR (length(a) >= 4 AND length(b) >= 4 AND (strpos(a, b) > 0 OR strpos(b, a) > 0)))
$fn$;

-- Each contact's company names, normalized once when written (normalizing at query time took 34 s for a ~27k-contact list; 0.1 s with
-- these). Not in schema.prisma: the database fills them, the app only reads them in raw SQL. The 31k-row table is rewritten once.
ALTER TABLE "SupportNetworkContact"
  ADD COLUMN IF NOT EXISTS "companyNorm" text GENERATED ALWAYS AS (nc_org_norm(company)) STORED,
  ADD COLUMN IF NOT EXISTS "inferredCompanyNorm" text GENERATED ALWAYS AS (nc_org_norm("inferredCompany")) STORED;
