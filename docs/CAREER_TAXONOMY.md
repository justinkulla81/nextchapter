# Career taxonomy, the Pivot Tool and skills fit

Public occupation data behind `/dashboard/pivot` ("Explore other roles"), the "Skills fit" line on job cards, and the grounded skill-gap suggestions. We adopt government data rather than maintain our own taxonomy.

## Scope: white-collar only

Loading all ~900 O*NET occupations would add trades, retail and service work we have no tools for. By default the O*NET import keeps an occupation only if **both** hold (`src/lib/careers/scope.ts`):

- its SOC group is Management (11), Business and Financial (13), Computer and Mathematical (15) or Legal (23), or one of these professional minor groups: 17-1 architects and surveyors, 17-2 engineers, 27-1 art and design, 27-3 media and communication, 41-1/41-3/41-4/41-9 sales (not 41-2 retail); and
- O*NET puts it in **Job Zone 4 or 5** (a bachelor's degree or more, considerable preparation).

The group list is a judgment call; edit `scope.ts` and re-run the import with `--prune`. `--scope all` loads everything. The dry run prints the real count (a few hundred is expected; not confirmed until the files are downloaded).

## Sources

| Data | Source | What it adds | Licence |
|---|---|---|---|
| Skills, Knowledge, Abilities, Work Activities | [O*NET database](https://www.onetcenter.org/database.html) | importance and level for each, 0 to 100. Broad, so they separate senior roles weakly | CC BY 4.0, credit required |
| Technology Skills | O*NET | named software and tools, with an in-demand flag. The most specific layer | same |
| Task Statements | O*NET | what the job does day to day (core tasks shown) | same |
| Alternate Titles, Related Occupations, Job Zones | O*NET | free-text title to occupation; adjacent roles; preparation level | same |
| Wage percentiles and employment, nation, state, metro | [BLS OEWS](https://www.bls.gov/oes/tables.htm) | local pay; see `docs/BLS_LOCAL_DATA_SCOPE.md` | public domain |
| Growth and openings | [BLS Employment Projections](https://www.bls.gov/emp/tables.htm), table 1.2 | outlook, typical education | public domain |
| Local openings (optional) | Adzuna via the existing cache | postings near the person | gated by `ADZUNA_INSIGHTS_ENABLED` |

Attribution: every page that shows O*NET-derived content renders `OnetAttribution` (Pivot Tool, job list, skill-gap suggestions). Keep its wording; it is the licence's.

## Setup

1. Create tables (before deploying code that reads them): `prisma/manual/2026-10-14-career-taxonomy.sql`, `2026-10-14-training-matching.sql`, then `2026-10-15-career-local.sql`.
2. `npm run careers:import-onet -- --dir <O*NET text folder> --version <n> --dry-run`, then without `--dry-run`. Add `--prune` after changing scope.
3. `npm run careers:import-bls -- --oews national.csv --oews-state state.csv --oews-metro msa.csv --wage-year <yyyy> --projections table1_2.csv` (dry run first).
4. `npm run careers:build-aliases -- --dry-run`, then for real. Optional and costs money: `--llm --max-calls 20` has a model draft matches for terms that match no tool. Review those rows afterwards.
5. `npm run careers:tag-courses`, and per state `npm run careers:import-training`.

All importers are re-runnable. Until step 2 is done, the Pivot Tool says occupation data isn't loaded and job cards show no skills-fit line.

## How it works

- **Similarity** (`vectors.ts`): each occupation is a vector of rated elements (importance x level), centred on the mean across occupations, otherwise everything scores about 0.9 against everything. "Lines up with your current work" is a separate measure: how much of what the target asks for the current occupation already covers. Abilities take part in the comparison but are never offered as something to build.
- **Pivots** (`pivots.ts`): ranked by skill similarity alone. Drops occupations more than one Job Zone below the current one and ones under the pay floor the person chose. Pay, growth and openings sit beside each option, not blended in.
- **Local pay** (`area.ts`, `local-pay.ts`): the person's metro area if we hold it, else their state, else national; two roles are compared in the same place. Executive pay above BLS's ceiling is shown as "or more" and reported as "at least".
- **Title to occupation** (`title-match.ts`, `candidate-occupation.ts`): no AI. Exact and clear matches against O*NET titles and alternate titles are accepted; anything ambiguous is put to the person as a short list; a job title that doesn't map is shown as "could not tell", never guessed.
- **Alias layer** (`skill-aliases.ts`): shorthand like "SFDC" maps to the O*NET tool. Built offline into `SkillAlias`; at runtime it is a lookup, so matching costs nothing per view. Aliases of one or two characters only match a keyword exactly.
- **Skills fit** (`skills-fit.ts`): a band (lines up closely, mostly, partly, few in common), next to the existing fit badge and not part of it. It compares occupations, not the posting's text, so it cannot see seniority or a posting's specific stack; the separate skills-gap line reads the posting. Candidates are shown bands, never raw scores, as everywhere else in the product.
- **Skill-gap suggestions** (`grounding.ts`): the target occupation's tools and knowledge gaps are added to the prompt, so the model phrases a deterministic list; they are also the fallback if the call fails.
- **Training** (`course-tagging.ts`, `training.ts`): catalog courses tagged to skills; state funded-program lists where loaded.

## Events

`pivot_tool_viewed`, `pivot_path_viewed` (per option, when scrolled into view: `fromSoc`, `toSoc`, `similarity`, `rank`, `payBasis`), `pivot_target_role_set`, `pivot_skills_added`, `pivot_occupation_confirmed`, `pivot_wage_floor_changed`, `pivot_course_clicked`, `pivot_program_clicked`, `skill_gap_viewed` (`targetSoc`, `grounded`, `source`).

## Cost and caveats

- The Pivot Tool and skills fit make no model calls. The only metered change is skill-gap suggestions: a candidate's cached suggestions regenerate once after the taxonomy is loaded (the cache key includes their occupation). The optional `--llm` step of the alias builder is a one-time offline cost you run and cap.
- Fit and gaps describe occupations in general, not a test of the person; the UI says so. Seniority is not in O*NET and comes from the existing level rank.
- O*NET's broad skills barely separate one senior role from another, so for executives the tools and tasks do most of the work.
- The importers were written against the documented O*NET and BLS file layouts and tested on small fixtures only. Run `--dry-run` first and check the counts.
- The taxonomy and pay are held in memory for an hour per server instance.
