# Employment Report: Anthropic Economic Index section

How the monthly "AI exposure and the jobs we see open" section is produced and worded. Code:
`src/lib/aei/`, `scripts/aei/run.ts`, `npm run aei:report`. Data: `data/aei/`.

## What it uses
- **Anthropic Economic Index (AEI) observed exposure** by occupation (`job_exposure.csv`, 756 SOC
  occupations, 0 to 1): the share of an occupation's tasks Claude is observed doing in work usage,
  limited to tasks an LLM could plausibly speed up. Usage-based, Claude-only, U.S. occupations,
  early-2023 capability ratings. Not a forecast, not job loss.
- **Postings we see open** (`CompanyJobOpening`), matched to occupations by job title.
- **Cross-checks** (rank correlation and biggest disagreements, same SOC 2018 codes):
  1. Microsoft "Working with AI" applicability scores (`microsoft/working-with-ai`, CC BY 4.0;
     Bing Copilot usage Jan to Sep 2024).
  2. OpenAI "GPTs are GPTs" exposure (`openai/GPTs-are-GPTs`, MIT; GPT-4 ratings from 2023, dated).
  3. Yale Budget Lab "Evaluating the impact of AI on the labor market" tracker, updated monthly
     (independent; checks whether the occupational mix is actually shifting). Read the current
     update by hand each month; its charts are not machine-readable.
- First measured agreement, 2026-10-22: AEI vs Microsoft rank correlation 0.58 (756 shared
  occupations); AEI vs OpenAI 0.70; Microsoft vs OpenAI 0.72. Moderate agreement, not identical:
  report disagreements, do not average them away.

## Disclosure (required wherever the section appears)
Anthropic, Microsoft and OpenAI are AI developers and the authors of these measures. NextChapter
also uses AI tools to produce this report. Yale Budget Lab's analysis depends on usage data from
OpenAI and Anthropic.

## Rules the section must follow
- Association only. Exposure and openings moving together is not attribution or causation. No AI
  forecasts or projections in the monthly report.
- Balanced: name bright spots and clouds. Exposed occupations with growing openings are a bright
  spot; exposed occupations with shrinking openings are a cloud; low-exposure occupations with
  shrinking openings need a different explanation. Constructive reading first where the data
  allows; never hide or soften a negative figure.
- Show match coverage on every exhibit. Unmatched postings stay unmatched. Suppress cells under 100
  open postings and show n. Postings are what we crawl, not all U.S. openings.
- Compare occupation counts with occupation counts and workforce-weighted shares with
  workforce-weighted shares, never across.
- Change in Anthropic's view: one stored vintage so far (2026-10-22). From next month the movers
  table shows real changes. Until then report only what Anthropic has published, quoting pages
  actually opened (labor-market-impacts article of 2026-03-05; the newest items on
  anthropic.com/research/team/economic-research; the numbered AEI report page).
- Anthropic's own early evidence (2026-03-05): no systematic rise in unemployment for highly
  exposed workers since late 2022; a small, barely significant fall in job finding (about 0.5
  points) for 22 to 25-year-olds entering exposed occupations; none for workers over 25.
- Subtle citation: name Anthropic and the other sources in the section's source line with the
  disclosure; do not make AEI a headline claim.

## Monthly steps
1. `npm run aei:report -- --asof <last day of reference month>` (needs `.env.local` database access).
2. Hand-check `match-sample-for-hand-check.csv` (200 titles); record the error rate in the report.
3. Read the new Yale Budget Lab update and any new AEI publication; note changes.
4. Write the section from `summary.md` and the exhibit CSVs; apply the rules above.
5. Commit the new vintage (if any) and the `report-YYYY-MM/` folder.

## Matching
Normalize titles (drop level words, locations, numerals, plurals; a posting title drops its comma
tail, an occupation title keeps its full name), then exact title, then plain "A and B" alternates
(never one generic word such as "Directors"), then a curated alias list, then near-exact fuzzy
(token overlap 0.75 or more with the same head noun). A title claimed by two occupations is left
unmatched.

Measured coverage, 2026-10-22 (run through Supabase, not the script, because this environment has no
direct database connection): on a random sample of 794 open postings from the whole table, 12.2%
match an occupation (95% interval about 10 to 15%); on the 125 most common open titles, which are
about a quarter of postings, about half match. Long-tail titles are idiosyncratic and many roles are
not in the AEI file, so the exhibits describe the matched postings only and say so. Hand check of the
97 matches in the sample: about 5 doubtful (for example a hospital billing operations manager mapped
to General and Operations Managers), about 95% right.

A first run caught a bug: occupation titles cut at their comma made every "Director, ..." posting
match "Directors, Religious Activities and Education" (coverage read 17.3%). Fixed, and covered by a
test. Grow the alias list from each month's hand-check; never loosen the fuzzy threshold to raise
coverage.
