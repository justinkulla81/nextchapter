-- Employee counts for companies, with the year each is for and where it came from (scripts/companies/import-wikidata-headcount.ts).
-- Additive: one new table, nothing existing is changed.
CREATE TABLE IF NOT EXISTS "CompanyHeadcount" (
  "companyId"   text PRIMARY KEY,
  "employees"   integer NOT NULL,
  "asOfYear"    integer NOT NULL,
  "source"      text NOT NULL,
  "sourceUrl"   text,
  "matchedName" text,
  "checkedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CompanyHeadcount_employees_idx" ON "CompanyHeadcount" ("employees" DESC);
