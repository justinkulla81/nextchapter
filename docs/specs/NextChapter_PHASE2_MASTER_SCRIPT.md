# NextChapter — Phase 2 Master Build Script

**Authoritative for everything from §12 onward.** Where this conflicts with any file in `docs/specs/`, earlier session instructions, or shipped code, follow this.

**Save this file to `docs/specs/` and read from there.** Do not rely on chat context — it gets compacted away. After any compaction, re-read this file rather than working from task summaries.

## Contents

| Part | Covers |
|---|---|
| **A** | §12–16 of the original master script: unified dashboard, resume tools, community, interim, release gates |
| **B** | Admin analytics — resume issue tracking and the candidate population report |
| **C** | Company pages and the insider network |
| **D** | New in this revision: auto-solicited intel, posting-age insight, ATS-aware resume checks, WARN alerts |
| **E** | Seed data — 50 test accounts with resumes |

## Companion files (data, not instructions)

These live alongside the code, not inside this document:

- `scripts/seed/nextchapter_seed_profiles.json` — 50 test profiles with activity data
- `scripts/seed/resumes/` — 50 `.docx` resumes, one per profile
- `scripts/seed/seed_profiles.ts` — step 1
- `scripts/seed/seed_resumes.ts` — step 2

See Part E.

---

# PART A — Original master script, §12–16

## 12. Unified dashboard

**One dashboard. No separate onboarding surface.**

**Activation items at top, never locked, in this order:**

1. Fix three things on your resume — 20 min
2. Send five reference requests — 5 min
3. Connect LinkedIn and Gmail — 1 click
4. Two quick question sets — 5 min

References sit second because they have the longest latency and they gate the jobs candidates came for. *Do the fast things first; start the slow things early.*

**Everything else below, grayed and locked**, showing title and unlock condition only.

**Always unlocked** so day one isn't a wall of locks:
- Complete your Operating Profile — 12 min
- Complete your Personality Profile — 9 min
- Review your Market Reality Report

These require no other person and no prior step — the tasks someone can do alone at 2am.

**Completed activation items collapse to a single checked line. When all four are complete, the activation group disappears entirely** and the list becomes ongoing Search Action Tasks. No congratulatory shell, no empty state.

**Locked items sort below unlocked ones** within their group.

---

## 13. Resume tools

### 13.1 The guided walkthrough is the primary experience

Reformatting is optional and comes near the end. Twelve steps, ~18 minutes:

overview → mechanical batch → target line → five guided bullets → two reviewer questions → thin entry → optional reformat → review and export

**Rules:**
- **One issue per screen.** A list of eleven problems is paralyzing; one problem with one decision is not.
- **Candidate approves every change.** Nothing applies silently.
- **Every detection is challengeable first** — *"We read a gap from March to December. Is that right?"* with *"No, I was working, let me fix the dates"* correcting the source data and removing the issue. A wrong detection must never become a card the candidate has to argue with.
- **Three kinds of "no," kept distinct:** *that's wrong* (correct the data) · *not applicable* (dismiss permanently, never re-raise) · *leave as is* (keep in open list, don't nag).
- **Never fabricate a number.** When they don't know: conservative estimate, range, or no number. Show this line on every guided card, not in a help link: *"Everything on your resume should be something you can talk about comfortably in an interview. If you're not sure, leave it out."*
- **Guided extraction, not rewriting.** Ask the two or three questions that unlock the bullet, then compose from their answers.
- Autosave every step; resume exactly where they stopped.

### 13.2 Design

Three templates, all single-column, all parse-verified in CI.

**Typography and whitespace carry the visual quality. Layout never does.** Everything that makes a resume look considered — type hierarchy, spacing rhythm, restraint, good margins — is invisible to a parser. Everything that breaks parsers adds nothing a human values.

- **No letter-spacing on headings.** It breaks tokenization and currently costs every fixture ATS points.
- Dates on **real right tab stops**, never spaces, never tables.
- Space before a heading ≈ 2.5× the space after it.
- One accent color, or none.
- **Never:** photos, icons, skill bars, columns, tables, text boxes, header/footer content, shading, boxes, page borders.

**The editor exposes no control that can break parsing.** Parse-safety is a property of the system, not a warning label.

Export both `.docx` and `.pdf` from the same source, never a conversion.

---

## 14. Community

Gate: **any qualifying badge** (§7.8 — Connected does not qualify).

> A room of people running the same search you are, at your level. Everyone here has done at least one hard thing to get in — which means nobody's here just to vent about the market.

**AI moderation on every post, human escalation:**

| Category | Action |
|---|---|
| **Recruitment fraud** — advance-fee scams, fake recruiters, resume-fee schemes, MLM | **Auto-hold, human review before publish.** Highest priority: job seekers are a prime target and members are financially stressed. |
| **Crisis and self-harm signals** | **Never auto-delete.** Route to human review immediately; surface Support During Transition to the poster. Deleting a distress post is the worst available outcome. |
| Harassment, abuse, discriminatory language | Auto-hold, human review |
| Doxxing and PII | Auto-remove, notify poster |
| Defamation of named individuals | Auto-hold. Employer criticism is legitimate; unverified accusations against people are not. |
| Spam, off-topic promotion | Auto-remove |
| Bad legal or financial advice | Flag with standing note pointing to qualified professionals |

**Prompted formats over an open feed** — introductions, wins, specific asks. Open feeds drift toward commiseration.
**Segment by seniority band**, function second.
**No DMs at launch** — fraud moves there the moment it's blocked in public.
**Human moderator from day one.** Not a set-and-forget surface.

---

## 15. Interim and fractional

**Access and guidance only. We do not place anyone.**

What we provide: fractional and interim job boards, board and advisory openings we hear about, and a playbook for setting up as an independent consultant.

**No copy anywhere may imply placement.** Earlier drafts said "we place candidates into interim work" — that is wrong and must not appear.

---

## 16. Verification — release gates

Fixture harness at `scripts/scoring-fixtures/` using Kwan, Solano, Hollander, Danforth, Whitcomb:

1. **Ordering** — Kwan > Solano > Hollander > Danforth > Whitcomb on Your Experience.
2. **Logo isolation** — Kwan and Solano must have identical pre-prestige base scores. Any other difference is a bug.
3. **Prestige cap** — zeroing prestige must not reorder candidates by more than one band.
4. **Scope over title** — Kwan's EVP → President transition must score as an increase.
5. **Self-check** — no rendered number contradicts its source document.
6. **Narrative alignment** — generate across the full band range; no report's prose may contradict its own letter.
7. **Movement is real** — apply exactly the three fixes Whitcomb's report recommends; he must move **at least a full band**. **Release blocker.** If effort doesn't move the number, the activation loop teaches candidates that effort is pointless.
8. **Function fairness** — an engineering fixture with no revenue metrics must not be penalized.
9. **Band fairness** — an early-career one-pager must not be penalized for length or thin board content.
10. **Unmeasured never grades** — a resume-only candidate must show zero letter grades on competencies, and 0 of 15 filled cells.
11. **No sibling rendering** — assert competencies never render at the same visual level as the five components.
12. **Measured-only** — a day-one candidate with zero Evidence and zero Effort must not be graded F; composite computes over measured components only.
13. **Market cap** — a fixture with Market F and A-grade everything else must cap at D, and its report must state the cause and the path.
14. **Component separation** — an ATS-broken Kwan must drop Your Resume sharply while Your Experience is unchanged.
15. **Gap scoring** — a fixture at 14 months unemployed must show a materially lower Your Experience than an identical fixture employed through today, and its report must lead with interim work.
16. **Interim resets the clock** — logging an interim engagement must measurably restore Your Experience.
17. **Volume is not effort** — a fixture with 150 applications and 0 interviews must score *lower* on Your Effort than one with 20 applications and 3 interviews.
18. **Every penalty has a route** — assert no strategy penalty renders without its specific fix.
19. **Low-band tone** — Whitcomb's full report must read as a route forward, not a wall.

Add two Kwan variants: **ATS-broken** (two-column, tables, image-only PDF) and **unquantified** (same roles and scope, all numbers stripped). All current fixtures share one template, so ATS Legibility is currently untested.

---

## 17. Never

1. Never average fixable and unfixable things into one letter
2. Never let profile completeness move the Market Reality Grade
3. Never render an unmeasured competency as a grade
4. Never hide a category for being empty
5. Never display, narrate, or imply prestige
6. Never gate the diagnosis, or the front door
7. Never gate anything on grade achieved rather than work done
8. Never generate a number the candidate didn't supply
9. Never promise placement, outcomes, timelines, or probabilities
10. Never suggest inflating a title, extending dates, or hiding a gap
11. Never email an address parsed from a resume without registration consent
12. Never auto-delete a crisis signal
13. Never tell a candidate their employer or school was insufficient
14. Never use the word "hireability" anywhere
15. Never render a strategy penalty without its specific fix
16. Never imply an employment gap reflects on the person — the market screens on it, and we end it
17. Never reward application volume that isn't converting

---

## 18. Migration checklist

- [ ] Grep and remove every `hireability` instance; add route redirect
- [ ] Rename `hireability-grade.ts` → `dossier-competencies.ts`
- [ ] Split into five components: Your Experience / Your Resume / Your Evidence / Your Effort / Your Market
- [ ] Move formatting, ATS, quantification, target line, mechanics, contactability, reconciliation out of Your Experience into Your Resume
- [ ] Implement Your Market as a cap (one band), never a weight
- [ ] Implement measured-only composite computation with proportional reweighting
- [ ] Add band-dependent weights to config (not code)
- [ ] Add compensation floor and work authorization as Your Market inputs
- [ ] Add current and historical unemployment duration to Your Experience (§3.8)
- [ ] Ensure interim/fractional/advisory engagement resets current-duration scoring
- [ ] Exclude duration from the "explanation neutralizes" rule
- [ ] Split Your Effort into Volume (40%) and Strategy (60%) per §3.9
- [ ] Implement the seven strategy penalties with escalation over time
- [ ] Add reference recency, relationship, coverage, and independence to Your Evidence
- [ ] Delete Target Fit as a standalone category; fold into Your Experience
- [ ] Restructure competency storage to per-source with a `measured` flag
- [ ] Roll Dossier completeness into Your Evidence
- [ ] Map reference questions to competencies
- [ ] Fix the five bugs in §8; add self-check
- [ ] Implement the unlock schema in §7
- [ ] Merge onboarding and weekly dashboards into one
- [ ] Add `n of 15` progress to every relevant surface
- [ ] Remove the resume column from competency scoring (double-counts Your Experience)
- [ ] Enforce visual nesting: competencies inside Your Evidence, never a sibling list
- [ ] Sweep homepage and marketing copy per §2
- [ ] Build fixture harness and pass all gates in §16

**Backfill:** existing users have blended competency scores with no source attribution. Mark them legacy and unmeasured rather than guessing which evidence produced them — a wrong attribution is worse than an honest blank, and it will surface as an inconsistency the first time a real reference lands.


---

# PART B — Admin analytics

**Principle:** every number here should be able to change a product decision. If a metric can't, don't build it.

## Prompt 1 — Issue taxonomy

Create `lib/analytics/issue-taxonomy.ts`. Every detection the scoring engine produces gets a stable `issue_code`, a category, and the dimension it affects. Codes are permanent — never renamed, only deprecated, or trend data breaks.

| Category | Example codes |
|---|---|
| `ats_parsing` | `letter_spaced_headings`, `content_in_table`, `multi_column`, `image_only_pdf`, `header_footer_content`, `nonstandard_section_name`, `inconsistent_date_format`, `unembedded_font`, `uninformative_filename` |
| `evidence_quality` | `no_metrics`, `metric_without_baseline`, `activity_not_outcome`, `low_quantification_density`, `weak_verbs` |
| `positioning` | `no_target_line`, `objective_statement`, `no_summary`, `backward_looking_summary`, `incoherent_trajectory` |
| `mechanics` | `typo`, `tense_inconsistency`, `bullet_too_long`, `bullet_fragment`, `page_count_mismatch`, `postnominal_credential`, `references_available_line`, `us_convention_violation` |
| `contactability` | `missing_phone`, `missing_linkedin`, `name_email_mismatch`, `missing_location` |
| `reconciliation` | `years_experience_mismatch`, `overlapping_full_time`, `credential_without_institution`, `scope_contradiction`, `tenure_date_mismatch` |
| `reviewer_question` | `unexplained_gap`, `current_gap`, `short_tenure_recent`, `short_tenure_cluster`, `scope_decrease`, `thin_recent_entry`, `stagnation`, `title_inflation`, `portfolio_career_read` |
| `structure` | `buried_lede`, `weak_ordering`, `orphaned_section` |

Each carries: `severity` (low/medium/high/critical), `dimension` (your_experience | your_resume), `typical_point_impact`, `fixable_in` (seconds/minutes/hours/not_fixable), `candidate_facing_label`.

---

## Prompt 2 — Schema

`resume_issues` — one row per detected issue per analysis. This is the analytics spine.

```
id, user_id, resume_analysis_id, issue_code, category, severity,
dimension, point_impact, detected_at,
resolved_at (nullable), resolution_type (fixed | dismissed_not_applicable |
  declined_leave_as_is | corrected_source_data | superseded),
surfaced_in_walkthrough (bool), walkthrough_step (nullable)
```

`population_snapshots` — one row per week per segment. Precomputed so trends don't recompute.

```
id, week_start, segment_type (all | seniority | function | industry |
  metro | persona | employment_status | usage_tier),
segment_value, member_count, <metrics jsonb>, computed_at
```

`admin_access_log` — every individual-record view by an admin.

```
id, admin_user_id, viewed_user_id, surface, reason, viewed_at
```

Indexes on `resume_issues (issue_code, detected_at)`, `(user_id)`, `(category, detected_at)`; on `population_snapshots (week_start, segment_type, segment_value)`.

RLS: service-role only. No client path reads these.

---

## Prompt 3 — Issue capture

Every scoring run writes its detections to `resume_issues`, not just to the report payload. Capture on:

- Initial resume upload
- Re-upload after outside editing
- Each save inside Resume Studio

**Resolution tracking is the point.** When a candidate applies a fix, dismisses it, or corrects the source data, stamp `resolved_at` and `resolution_type`. This yields fix rates, and **fix rate is the single most actionable metric in the product**: if a recommendation is surfaced 900 times and applied 40 times, the copy is wrong or the fix is too hard. That's a product bug the scoring engine can't see.

Never delete rows on re-upload. A new analysis creates new rows; old ones get `superseded`.

---

## Prompt 4 — Admin: resume issue analytics

Route `/admin/issues`. Service-role auth, admin role required.

**Filters, all combinable:** date range · seniority band · function family · industry · metro · persona · employment status (employed / unemployed, with duration bucket 0–3, 3–6, 6–12, 12–24, 24+ months) · usage tier · issue category · severity.

**Views:**

1. **Prevalence** — issue codes ranked by share of analyses containing them. The headline table. Drives what to build next: if 78% of resumes have `letter_spaced_headings`, that's a bulk fixer, not a walkthrough step.

2. **Prevalence by segment** — the same table pivoted. Answers whether executives have different problems than mid-level, whether engineers under-quantify more than salespeople, whether the long-term unemployed present differently. Highlight cells that deviate more than 1.5σ from the overall rate.

3. **Fix rates** — per issue code: times surfaced, times fixed, times dismissed, times declined, median time-to-fix. Sort ascending by fix rate. **The bottom of this list is the product backlog.**

4. **Point impact** — total points lost per issue code across the population, and average per affected candidate. Distinguishes common-but-trivial from rare-but-severe.

5. **ATS failure matrix** — parse failure rate per engine (Workday, Taleo, Greenhouse, Lever, Ashby, iCIMS, SuccessFactors, BrassRing, Textkernel, Daxtra, Affinda, RChilli), and which issue codes cause each failure. Tells you which parser to prioritize.

6. **Co-occurrence** — which issues cluster. If `objective_statement` and `no_metrics` co-occur at 4× base rate, that's a candidate archetype worth a tailored walkthrough.

Every view exports CSV.

---

## Prompt 5 — Admin: population report

Route `/admin/population`. Two modes: **This week** and **All time**, with a week picker for history.

**Composition** — counts and percentages by seniority band, function, industry, metro, persona, employment status and duration, usage tier, background strength. Each with week-over-week delta.

**Funnel** — resume uploaded → registered → activation complete → first reference requested → 5 references returned → both assessments → Dossier complete. Show conversion at each step and median time between steps. **The largest drop-off is always the next thing to fix.**

**Grades** — distribution of Market Reality Grade and of each of the five components. Median grade movement for members present in both this week and last. Count capped by Your Market.

**Activity** — median and p90 for outreach, applications, LinkedIn posts, community posts, Sprint completion. Share of members active this week. Share dormant 21+ days.

**Search outcomes** — application→response, response→interview, interview→offer, by segment. Median search duration for members who marked themselves hired. **This is the only real validation the scoring weights are right** — regress time-to-offer against component scores once n is large enough.

**Targets and demand** — most-named target roles, industries, metros. Cross-referenced against `ncrawl` posting volume to surface where members are concentrated in thin markets. Directly informs which employer relationships to build.

**Retention** — weekly cohort retention grid. Members joining week N, still active at weeks N+1…N+12.

**Confidential mode** — share of members in it, by persona. Watch this: if it climbs, visibility features are under-serving people.

---

## Prompt 6 — Weekly snapshot job

Cron, Monday 00:15 UTC. Computes every metric in Prompts 4 and 5 for the prior week, across every segment dimension, and writes to `population_snapshots`.

Idempotent — rerunning a week overwrites cleanly. Retain snapshots indefinitely; they're small and they're the trend data.

Trends read snapshots, never live tables. A dashboard that recomputes 40 weeks of history on load will be abandoned.

---

## Prompt 7 — Observations

Auto-generated narrative at the top of each admin view. Rules-based first; add an LLM pass over the computed stats only after the rules are in place — the model summarizes numbers, never invents them.

Generate observations for:
- Any issue prevalence shifting more than 10 points week over week
- Any segment deviating more than 1.5σ from the overall rate on a major metric
- Any funnel step whose conversion dropped more than 5 points
- Any issue whose fix rate is below 25% after 100+ surfacings
- Any segment where median time-to-first-interview exceeds 1.5× the population median

Example output:

> **Engineering candidates score 14 points below average on Your Evidence.** Reference requests from engineers convert at 31% versus 58% overall. Worth checking whether the request copy reads wrong for that audience.

> **`no_target_line` was surfaced 412 times this week and fixed 61 times (15%).** It is the highest-point-impact fix in the product and the second-least-applied. The copy or the placement is wrong.

Each observation links to the filtered view that produced it.

---

## Prompt 8 — Privacy and access

**Aggregate first.** Every view defaults to aggregate. Individual records require an explicit drill-down.

**Minimum cell size of 5.** Any segment with fewer than 5 members shows "insufficient data," never counts. A segment of 2 identifies people.

**Log every individual-record view** to `admin_access_log` with a required reason field. Not optional, not a text box that accepts empty.

**Confidential Search Mode members appear in aggregates**, but their individual records require a stated support reason and are logged more prominently.

**Never expose in admin analytics:** blockers, motivations, emotional state, the free-text "what gets you up in the morning," or networking hesitation. Those are private to the member and their coach. Master script §12 already establishes this; enforce it at the query layer, not the view layer.

**Never build a "members at risk of churning" list** that surfaces distress signals. Retention analysis stays aggregate.

---

## Prompt 9 — Verification

1. Seed data (`seed_profiles.ts`, `seed_resumes.ts`) produces a populated admin dashboard with no empty states.
2. All 50 seed resumes generate `resume_issues` rows; weak-background resumes generate materially more than strong.
3. Minimum cell size holds — filter to a 2-member segment and confirm suppression.
4. Every individual-record view writes an `admin_access_log` row.
5. No admin query returns blockers, motivations, or emotional state.
6. Snapshot job is idempotent — run twice for the same week, confirm identical output.
7. Trend views read snapshots only. Confirm no live-table scan on load.
8. Fix-rate calculation is correct — apply three fixes as a seed user, confirm resolution counts move.


---

# PART C — Company pages and the insider network

**The core idea:** Glassdoor tells you what it's like to work somewhere. This tells you **how to actually get hired there** — the interview loop, who decides, what they test, how long it takes. That's information senior people trade privately and nobody has systematized.

## Prompt 1 — Schema

```
companies
  id, name, canonical_domain, ats_platform, industry, size_band,
  hq_metro, is_verified, created_at

company_signals              -- from ncrawl + WARN, refreshed nightly
  id, company_id, week_start, open_roles_total, open_roles_director_plus,
  roles_delta_4wk, roles_delta_12wk, trajectory (growing|flat|contracting),
  warn_filings_12mo, warn_employees_affected, top_functions_hiring jsonb,
  top_skills_requested jsonb, median_posting_age_days

member_employment            -- the contribution graph
  id, user_id, company_id, title, function, seniority_band,
  start_date, end_date (null = current), is_current,
  visible_as_insider (bool, default true), verified_from_resume (bool)

company_intel                -- crowdsourced "how to get hired here"
  id, company_id, contributor_user_id, intel_type, body,
  role_level_at_time, recency_bucket, is_anonymous (default true),
  helpful_count, status (pending|published|removed), created_at

insider_requests             -- 1:1 asks
  id, company_id, asker_user_id, insider_user_id, question,
  status (pending|accepted|declined|expired|answered),
  answer, asked_at, responded_at

company_application_outcomes -- aggregate only
  id, company_id, week_start, applications, responses, interviews, offers
```

RLS: `insider_requests` readable only by the two parties. `member_employment` rows where `visible_as_insider = false` are never exposed. Aggregates enforce minimum cell size 5.

---

## Prompt 2 — Signals from existing infrastructure

Nightly job populating `company_signals`. Everything here comes from systems already built.

**From `ncrawl`:** open role counts (total and director-and-above), 4- and 12-week deltas, functions hiring, skills requested (extracted from posting text), median posting age. Posting age matters — roles sitting 90+ days signal either a broken process or an unrealistic bar, and candidates should know before they invest.

**From the WARN agent:** filings in the last 12 months, employees affected, dates, locations.

**Trajectory** is computed, not stated: growing / flat / contracting from the 12-week delta, with WARN filings overriding to contracting regardless of postings.

---

## Prompt 3 — Company page, candidate view

Route `/companies/[id]`. Reachable from any job listing, matched job, or search.

**Header** — name, industry, size, HQ, ATS platform (useful: it tells the candidate which parser will read their resume).

**Hiring signal**
> **Open roles: 34** (12 at director level and above) · **Up 40% in 12 weeks**
> Hiring most in: Engineering, Finance, Operations
> Median posting age: 21 days

**Contraction signal** — shown plainly when present, never buried:
> **WARN filing: 140 employees, March 2026, Austin.** Postings are down 22% since. This doesn't mean don't apply — it means ask about team stability in the loop.

**Skills they hire for** — extracted from their own postings, ranked by frequency, with the member's own gaps flagged: *"You match 7 of their top 10. Missing: SOX, NetSuite."*

**How to get hired here** — the crowdsourced core. Structured intel types:
- Interview loop structure and number of stages
- Typical timeline start to offer
- What they actually test for
- Who makes the decision
- Recruiter responsiveness
- What's killed other candidates

Each shows contributor context only: *"A former Director, left within 2 years."* Never a name unless the contributor chose otherwise.

**How members have fared** — aggregate, min cell size 5:
> **41 members applied. 12 heard back. 5 reached interview.** Response rate 29%, above the 21% platform median.

**People who know this company** — insiders (see Prompt 4).

**Your fit** — target match, skills gap, and which of their resume versions is the best fit for roles here.

---

## Prompt 4 — The insider network

### 4.1 Contribution unlocks access

**A member must tag their own employment history before they can query anyone else's.** Everyone who uses the graph feeds it. Tagging is near-free — it's parsed from their resume and they confirm it.

> **Add where you've worked to unlock this.** We'll pull it from your resume — just confirm. Members who tag their history can see who's worked at companies they're targeting, and get asked in return.

### 4.2 Insider display

Show role level, tenure recency, and function. Never a name until an ask is accepted.

> **3 members worked here.**
> A former VP Finance — left within 2 years
> A former Director, Engineering — left 2–5 years ago
> A current employee — Marketing

Current employees appear only if they opted in explicitly, with a separate warning that they may be asked about their own employer.

### 4.3 The ask

Request/accept, question first:

> **Ask someone who worked here**
> They'll see your question and your level — *a VP Finance candidate* — not your name. If they accept, you'll both see each other.
>
> Suggested: *"What does the interview loop actually look like?"* · *"Who makes the final call?"* · *"What tends to kill candidates here?"*

**Declines are silent.** The asker sees "no response yet," never a rejection. This protects both sides and keeps the ask cheap to send.

Rate limit: 3 outstanding asks per member. Expire unanswered after 14 days.

### 4.4 Teamwork points

| Action | Points |
|---|---|
| Tag an employer (one-time per company) | 10 |
| Contribute a piece of company intel | 25 |
| Answer an insider request | 40 |
| Intel marked helpful by another member | 15 |

New badges: **Insider** (answered 1 request) · **Guide** (answered 5) · **Contributor** (10 pieces of published intel).

All qualify for the Community gate — helping other members is unambiguously real work. Adds a **Teamwork** weekly leaderboard alongside the existing five.

---

## Prompt 5 — Guardrails

These are the ones that will cause real harm if missed.

**Asks are never visible to anyone but the recipient.** Never aggregated, never shown as "3 members asked about Meridian this week," never exposed on any admin surface as an individual record.

**The manager problem:** a member's own manager could join and discover their reports are looking. Therefore — never show who asked about a company; never show a member's *current* employer to other members; never let a company page reveal that a specific person is job-searching.

**Non-disparagement exposure:** severance agreements routinely contain non-disparagement clauses, and a member could breach one by posting. Every intel prompt is framed toward **process and preparation, never grievance** — "what should someone expect in the loop," never "what's wrong with this company." Moderation removes: named individuals, allegations of misconduct, and anything reading as a grievance rather than guidance.

**Confidential Search Mode members** may contribute anonymously and may ask, but are **never listed as insiders by name** and never surfaced as current employees.

**Compensation:** allow ranges and bands, block anything presented as a specific individual's pay. Note that compensation-sharing protections under the NLRA generally don't extend to supervisory and executive employees, which is most of this population.

**Moderation** runs on all intel before publish, using the Community categories from `NextChapter_Search_Visibility_and_Leaderboards.md` §8, plus the two above.

---

## Prompt 6 — Company page, admin view

Route `/admin/companies/[id]`. Everything in the candidate view, plus:

**Member concentration**
- Members who have worked there, by function and seniority
- Members who list it as a **current** employer
- **Members from this company currently searching**, aggregate only, minimum cell size 5

**Demand signal**
- Applications from members to this company, response and interview rates
- Members naming it as a target employer
- Where it ranks among named targets

**Outplacement sales signal** — this is the commercially useful view, and it composes signals already being collected:

> **Meridian Health — outplacement pitch signal: HIGH**
> WARN filing: 140 employees, March 2026 · Postings down 22% in 12 weeks
> 11 members list Meridian as a current employer · 7 are actively searching
> Trajectory: contracting

Rank all companies by this composite so the sales list is generated rather than assembled by hand. This is the same logic already running in the WARN lead-generation pipeline — extend it rather than duplicate it.

**Intel health** — volume, helpful rate, moderation removals, coverage gaps (target companies with zero intel).

---

## Prompt 7 — Admin guardrails on the nervous-employee data

**This is the most sensitive dataset in the product.** It identifies which employers have staff quietly looking. Treat accordingly.

1. **Minimum cell size 5, no exceptions.** Fewer than 5 searching members at an employer shows "insufficient data," never a count. Below that threshold a number identifies people.
2. **Aggregate only. No individual drill-down from a company page, ever.** Not with a reason field, not for support. If an admin needs to help a specific member, they go through the member, never through the employer.
3. **Every view of this panel is logged** to `admin_access_log` with a required reason.
4. **Never exposed outside the admin surface.** Not in exports, not in sales collateral naming a company alongside a searcher count, not in any API.
5. **Never shown to anyone affiliated with that employer.** Add an explicit check.
6. **Never sold or shared as company-level searcher data.** The outplacement pitch uses public WARN filings and posting trajectory. Member counts inform *internal prioritization only* and must not appear in anything that leaves the building.
7. Members are told this exists, in plain language, in the privacy policy: aggregate employer-level statistics may inform which companies we approach about outplacement services; individual search activity is never disclosed to an employer.

---

## Prompt 8 — Verification

1. Seed data populates company pages — link the 50 seed members' employment history to generate insiders and intel.
2. Minimum cell size holds on every aggregate: filter to a 2-member company, confirm suppression.
3. An ask is invisible to everyone but the recipient — assert no admin query or aggregate returns asker identity.
4. A member in Confidential Search Mode never appears as a named insider or current employee.
5. Declines are silent — asker sees no distinction between declined and pending.
6. `visible_as_insider = false` excludes a member from every surface.
7. Moderation runs before publish, not after.
8. Every nervous-employee panel view writes an `admin_access_log` row with a reason.
9. Non-disparagement framing: intel prompts contain no grievance-eliciting language.

---

# PART D — New in this revision

## D1. Auto-solicited intel — the candidate never has to ask

**Pull requires the candidate to know to ask. Push gets the answer to them before they need it.**

### D1.1 Trigger

When a member applies to a company, or saves a role there, the system automatically asks matching insiders on their behalf. No action required from the applicant, and no notification that a request went out until an answer arrives.

### D1.2 The insider prompt

Sent to up to three matching insiders — closest by function and recency first:

> **Someone's applying to Meridian Health this week.**
>
> You worked there as a Director in Engineering. Two minutes of your time would help them a lot.
>
> **What does the interview loop actually look like there?**
> **What tends to separate the candidates who get offers?**
>
> [Answer] · [Not this one] · [Stop asking me about Meridian]
>
> *Your answer goes to them anonymously — they'll see "a former Director in Engineering," not your name.* **+40 points**

### D1.3 Delivery to the applicant

Answers arrive in the applicant's Search Action Plan and as a notification:

> **Someone who worked at Meridian answered a question for you.**
>
> *A former Director in Engineering, left within 2 years:*
> "Four stages. The panel is the real gate — they run a live systems design and score it independently before anyone talks. The recruiter screen is a formality. Budget three weeks end to end."

### D1.4 Reuse

Answers are published to the company page after moderation, so the second person applying gets it instantly. **Ask once, help everyone.** Never re-ask an insider a question that's already been answered well — check for existing published intel first.

### D1.5 Rate limits and courtesy

- Maximum 2 auto-requests per insider per month, across all companies
- Never ask about a member's **current** employer unless they explicitly opted in
- "Stop asking me about X" is permanent and per-company
- Declines are silent and never surfaced to the applicant
- Never tell an insider *who* is applying — only that someone is

### D1.6 Guardrail

The applicant's identity, and the fact that they applied, is never revealed to the insider. This is the manager problem from Part C §5 — an insider could be a colleague at the applicant's current employer.

---

## D2. Posting age as an actionable insight

Median posting age is already computed in `company_signals`. Surface it as a **judgment**, not a number.

| Median age | Rendering |
|---|---|
| Under 21 days | **Moving fast.** Roles here fill in about 3 weeks. Apply promptly — this company doesn't sit on candidates. |
| 21–60 days | *(no callout — normal)* |
| 60–90 days | **Slow process.** Roles sit about 10 weeks. Expect a long loop and plan your follow-up cadence accordingly. |
| Over 90 days | **Roles here have been open a long time.** That usually means a broken process, an unrealistic bar, or a role nobody's actually approved to fill. Worth asking the recruiter directly what stage the search is at before you invest three weeks in it. |

Feed the same signal into the Search Action Plan: when a member applies somewhere with a 90+ day median, the follow-up task is scheduled longer out and the coaching note explains why.

---

## D3. ATS-aware resume checks

`company_signals.ats_platform` is known per company from the `ncrawl` adapters. Use it.

**On the company page:**

> **They use Workday.** Your resume currently loses 3 of your 9 job titles in Workday's parser. [Fix this in Resume Studio →]

**On the job listing, before applying:**

> **Before you apply:** this posting runs through Taleo, which drops your date formatting. Two-minute fix. [Open Resume Studio]

**In Resume Studio tailoring mode**, when tailoring for a specific job, run the parser check for *that company's* platform first and surface its failures at the top of the fix list — ahead of generic issues.

This closes the loop between the ATS matrix, the company page, and the resume tool. No competitor can do this because none of them know which ATS a given employer runs.

---

## D4. WARN alerts

The WARN monitoring agent already runs Sunday 3AM ET. Route its output to affected members.

### D4.1 Two audiences, two very different messages

**Members who list the company as a current employer.** This is their job. Handle with care — it's public information they'd want, and it may be the first they hear of it.

> **Meridian Health filed a WARN notice.**
>
> 140 positions, Austin, effective May 2026. This is a public filing and it may not affect your role — but you'd want to know.
>
> If it does affect you, a few things are worth doing now while you still have access: save your work samples, note your metrics, and ask two colleagues if they'd serve as references. Those get harder after a departure.
>
> [What this means] · [Update my status]

Note what it does **not** do: it doesn't tell them to panic, doesn't assume they're affected, and doesn't push a product upsell. The reference suggestion is genuinely the highest-value thing they can do in that window, and it happens to be the platform's core mechanic.

**Members targeting the company.** Different message entirely:

> **Meridian Health filed a WARN notice — 140 positions, Austin, May 2026.**
>
> You have them on your target list and applied to a Director of Finance role three weeks ago. Hiring often slows or freezes around a filing.
>
> Worth doing: follow up with the recruiter to confirm the role is still funded, and widen your list. [See similar roles at 6 other companies]

### D4.2 Rules

- **Never speculate.** State the filing, the count, the location, the effective date, and nothing more. Never predict who's affected.
- **Never say "your job is at risk."**
- **Never use a WARN alert as a sales moment.** No coaching upsell, no premium pitch, no urgency framing. The reference suggestion is advice, not a funnel.
- Members in Confidential Search Mode get these normally — it's their employer, and the alert is private.
- One alert per filing per member. Never repeat.
- Neutral email subject line: *"A public filing at your company."* Work email and shared screens are the threat model.

### D4.3 Persona transition

A member on the Worried persona whose employer files a WARN notice is likely to become Laid off. **Prompt, never auto-switch:**

> Has your situation changed? [Yes, I've been laid off] · [No, not affected] · [Not sure yet]

Selecting laid off updates the persona, re-runs the Market Reality Grade, and offers to turn off Confidential Search Mode — offers, does not do it.


---

# PART E — Seed data

50 test accounts with realistic activity, so leaderboards, community, company pages, and admin analytics can be exercised against populated surfaces rather than empty states.

## E1. Files

| File | Put it at |
|---|---|
| `nextchapter_seed_profiles.json` | `scripts/seed/` |
| `seed_profiles.ts` | `scripts/seed/` |
| `seed_resumes.ts` | `scripts/seed/` |
| `resumes/` (50 `.docx` files) | `scripts/seed/resumes/` |

The `resumes/` folder **must sit beside `seed_resumes.ts`** — the script resolves `./resumes` relative to itself.

## E2. Running

```
cd scripts/seed
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx seed_profiles.ts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx seed_resumes.ts
```

Profiles first, resumes second. Both refuse to run against a URL containing `prod`. Password for all 50 accounts: `AAAABBBB!`

Before running, confirm two things:
1. `TABLE_MAP` at the top of `seed_profiles.ts` points at the real table names
2. The Storage bucket name and `resume_versions` columns in `seed_resumes.ts`

## E3. What the data is built to test

**Emails** `justin.kulla+1@gmail.com` through `+50`. Accounts +1–+5 correspond to the original scoring fixtures (Kwan, Hollander, Solano, Danforth, Whitcomb), so calibration tests and the seed environment stay consistent.

**Background strength is decorrelated from activity**, so all four quadrants are populated:

| | High activity | Low activity |
|---|---|---|
| Strong background | 9 | 7 |
| Weak background | 9 | 7 |

Middle: 18. The cases that break naive assumptions — **Denise A.**, C+ experience near the top of the leaderboard; **Vikram S.**, A-grade experience, lapsed, zero points.

**Usage tiers:** 8 power, 20 active, 12 moderate, 6 lapsed (high lifetime, zero current week — the case that breaks leaderboard queries), 4 brand new.

**12 members in Confidential Search Mode**, some with high point totals. These must appear on no leaderboard, in no community name display, and as no named insider. **This is the first thing to verify.**

**10 with complete Dossiers**, so recruiter introductions and unposted roles have something to gate on.

**9 functions, 16 metros**, with deliberate clustering so band and function segmentation have something to segment.

**Resume quality varies to match each profile's `your_resume` grade** — 17 strong, 23 mixed, 5 weak. Running the real scorer against these files should roughly reproduce the grades in the JSON. If it doesn't, that's a scoring bug worth chasing.

A few resumes carry deliberate scope/title mismatches — a Senior Account Executive claiming 320 sellers — to exercise the `title_inflation` detection.

## E4. Verification against seed data

1. All 50 accounts create successfully
2. Confidential Search Mode members appear on no public surface
3. Admin dashboards populate with no empty states
4. All 50 resumes generate `resume_issues` rows; weak-background resumes generate materially more than strong
5. Leaderboards populate and the lapsed cohort sorts correctly (high lifetime, zero weekly)
6. Company pages populate from seeded employment history
7. Minimum cell size holds — filter to a 2-member segment and confirm suppression
