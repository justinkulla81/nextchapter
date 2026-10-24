# Company size sources (2026-10-23)

Employer size bands for the board's level flex come from `loadBoardCompanySizes` (src/lib/market/company-size.ts):
static tier list > `CompanySizeLookup` > `Company.sizeBand`, keyed on `normalizeOrgName`. No LLM call is made at read time.

A free-data fill (no LLM) wrote bands from public filings. Each row in `CompanySizeLookup` carries its source and the
evidence (headcount, filing, year) in `llmRawNotes`.

## Precedence (strongest first)

1. Static tiers (company-size-tiers.ts), never touched.
2. `sec_10k`: employee count read from the latest 10-K / 20-F Item 1 text (dei:EntityNumberOfEmployees is essentially never tagged).
3. `ipeds`: NCES IPEDS 2023 total employees, universities and colleges only (excludes affiliated hospital staff).
4. `irs_990`: Form 990 Part I employee count, latest e-filed return. Name-only matches need a multi-word name and a non-startup source.
5. `fdic`: bank call report NUMEMP (2026-06-30).
6. `wikidata`: P1128, only if dated 2022 or later (2019 or later for 20,000+; undated only for 10,000+) and a business/organization type.
7. `llm` (old cache rows): replaced by any of the above; nothing else is overwritten, and an existing non-null `Company.sizeBand` is never changed.

If two sources disagree by more than 3x, the larger wins (failure modes are a regex or label match landing on a subset), except
a stale Wikidata value never overrides a filing. SEC values with revenue per employee above $4M and under 5,000 employees are dropped.
Startups with no filing are not guessed.

Bands: MICRO 1-10, SMALL 11-50, SMALL_MID 51-200, MID 201-1000, MID_LARGE 1001-5000, LARGE 5001-20000, ENTERPRISE 20001-100000, MEGA 100000+.
Pipeline scripts: ~/nextchapter-jobs/scripts/size_fill/.
