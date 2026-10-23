# Research memo: how AI capability becomes organizational and labor-market change

NextChapter Displacement Report, September 2026 edition (Version 1.7). Prepared October 6, 2026. Reference period: September 1–30, 2026.

Every figure below was checked against a primary source where one could be reached; exceptions are marked. **[Vendor]** = reported by the company that sells the product. **[Forecast]** = a prediction, not a measurement.

---

## 1. Executive verdict

**The framework is an improvement, but as a reading lens for the report, not as its new thesis.**

The "three speeds" idea (capability, organizational rewiring, labor-market adjustment) organizes facts the report already has. It explains why AI layoffs are rare while searches lengthen and hiring per opening falls. It also gives readers a principled way to discount both benchmark hype and "no AI effect" claims.

But it is not new. It restates the productivity J-curve (Brynjolfsson, Rock and Syverson, 2021), Paul David's dynamo analogy (1990), Bresnahan, Brynjolfsson and Hitt's complementarity work (2002), and Agrawal, Gans and Goldfarb's "between times" (2022). It also cannot yet be tested in its most interesting form: no study estimates the lag from demonstrated capability to job effects, and capability has no common unit.

**What actually improves the report** is narrower:

1. **A measured answer to "is displacement hiding inside jobs?"** New CPS calculation: it isn't, so far.
2. **A sober feature that places our data in the three-speed frame**, with an explicit evidence scorecard.
3. **Verified hiring-loop research.**
4. **A permanent change-record standard.**

Everything else belongs in the research agenda. I added those four to Version 1.7 and kept the rest out.

## 2. What is genuinely novel (ranked)

"Novel" means not found as a recurring product in our scan of about 26 trackers. That is not proof nobody does it.

1. **White-collar long-term unemployment index from CPS microdata**, published monthly with margins of error. Closest competitors:
   - Richmond Fed: a three-part brief series that has ended.
   - California AI-Unemployment Tracker: one state, unemployment-insurance claims only.
   - Yale Budget Lab: an exposure framing, not durations.
2. **The announcement-versus-filing attribution gap**: 21% of announced cuts cite AI vs 9% of SEC Item 2.05 filings, hand-coded. No recurring version was found. New York's AI checkbox on WARN layoff notices is an unused natural experiment worth adding: 0 of 160+ filers checked it in its first year.
3. **An integrated "beyond unemployment" white-collar panel**: involuntary part-time, multiple jobs, self-employment and hours, by occupation. Every input is public; the package isn't. First reading in v1.7.
4. **Nativity decomposition of white-collar long searches**: not found in any AI tracker.
5. **Revenue per employee for a fixed large-firm panel**: not found as a recurring series. It is context, not attribution.
6. **The three-speed evidence scorecard** (supported / consistent but unproven / not observed / not measurable). The framing isn't new; a recurring, falsifiable scorecard tied to monthly data is.

## 3. What is already well covered (do not present as novel)

- **AI adoption rates:** Census BTOS, St. Louis Fed RPS, Gallup, Ramp, Microsoft, McKinsey.
- **AI mentions in job postings:** Indeed, Lightcast.
- **Employment by age and AI exposure:** Stanford's monthly dashboard, Revelio, Yale, Anthropic.
- **Counts of AI-cited layoffs:** Challenger plus many copies.
- **AI capability benchmarks:** METR, Epoch, Stanford AI Index.
- **The capability-deployment gap as an idea:** J-curve, McKinsey's "Superagency" (only 1% of firms say they are mature), Epoch's GATE model.
- **"Human premium" in customer service:** Gartner covers it heavily; it is a survey of leaders, not price data.
- **Hiring-funnel volumes:** Greenhouse, Ashby, Huntr, LinkedIn. We can curate these, not own them.

## 4. What is empirically supported now

**Observed (data):**
- **Capability on measured tasks is rising fast.** METR's 50% time horizon doubles every about 4–7 months: about 5 minutes for GPT-4 (2023), at least 16 hours by spring 2026. METR calls anything above 16 hours unreliable, and 80% horizons are about 1–3 hours. GDPval (share of expert-level tasks) went from 47.6% for the best model at launch (Sept 2025) to 84.9% in April 2026 **[Vendor]**. OSWorld has vendor-reported scores above the 72.4% human baseline from March 2026.
- **Firm adoption is modest and rarely changes headcount.** Census BTOS shows 17–20% of firms using AI in any function (Dec 2025–May 2026; the question was broadened in November 2025, so the series has a break). About 95% of using firms report no AI-attributable headcount change.
- **Worker use is higher than firm use, and time saved is small.** St. Louis Fed RPS: 39.2% used generative AI for work last week (Q2 2026). Share of all hours saved rose from 1.6% (Q3 2024) to 2.2% (Q2 2026).
- **Danish evidence finds small effects on pay and hours.** In Denmark, users save 2.8% of hours, with "precise zero" effects on earnings and hours, and AI created new tasks for 8.4% of workers (Humlum and Vestergaard, 2025).
- **Adjustment runs through hiring.** Employment of 22–25-year-olds in the most exposed jobs is 19% below comparable peers (Stanford, Aug 2026). AI is "an important but not dominant factor" in the falling job-finding rate (Richmond Fed EB 26-27, Aug 2026). Yale (Sept 15, 2026) finds no link between AI usage and employment or unemployment.
- **No hidden displacement among employed white-collar workers** (NextChapter CPS, Jan–Aug 2026 vs 2025):
  - Involuntary part-time: 1.37% vs 1.39%.
  - Multiple jobs: 6.19% vs 6.50%, a fall.
  - Self-employment: 11.29% vs 11.33%.
  - Hours: 39.6 vs 39.5.
- **Customer service: leaders keep human roles while cutting through attrition.** Gartner (Apr 2026, 321 leaders): 85% are expanding human agents' responsibilities, 31% have made or plan AI-driven frontline layoffs, and 63% are reducing headcount through attrition. 87% of customers say a firm using GenAI must offer a human (Aug 2026).
- **Klarna** (company statements and filings):
  - Feb 2024: two-thirds of chats handled by AI, "700 agents."
  - Headcount: about 5,500 (2022) to about 2,900 (Nov 2025 investor deck).
  - May 2025: the CEO said cost focus produced "lower quality," and the firm began piloting on-demand human agents.
  - There is no independent quality data.
- **Hiring research:**
  - LLM screeners favor résumés written by the same model 67–82% of the time (Xu, Li and Jiang, 2025).
  - Custom applications lost their hiring premium after AI writing tools arrived (Galdin and Silbert, 2025).
  - AI-led interviews raised offers 12% (Jabarian and Henkel, 2025; firm-sponsored).

**Inference (not observed):**
- That organizational rewiring is the binding constraint, rather than demand, interest rates or post-pandemic correction.
- That capability leads labor effects by any particular lag.
- That a "human premium" exists in prices or wages. We found no willingness-to-pay evidence.
- That saved time becomes fewer jobs rather than more output.

## 5. What is measurable monthly (or near-monthly)

| Variable | Source | Frequency | History | Population | Exact measure | Major limitation |
|---|---|---|---|---|---|---|
| White-collar long-term unemployment | Census CPS microdata | Monthly (pooled) | 1994– (occupation-code break 2020) | Unemployed whose last job was management/professional | Unemployed 27+ weeks, % of white-collar labor force | Small cells; non-response |
| Involuntary part-time, multiple jobs, self-employment, hours (white-collar) | CPS microdata | Monthly | 1994– | Employed white-collar | PRWKSTAT 3/6; PEMJOT; PEIO1COW 6–7; PEHRACTT | Variance parameters not yet applied; no payroll-to-contract flow |
| Same, all workers | BLS CPS Tables A-8, A-9 | Monthly | 1955–/1994– | Employed | Seasonally adjusted levels | Cyclical; no cause |
| Average and aggregate weekly hours by industry | BLS CES B-2, B-4 | Monthly | 2006– | Private payrolls | Hours paid | Not hours worked |
| Hires, openings, quits, layoffs | BLS JOLTS | Monthly | 2000– | Establishments | Hires per opening | No unfilled-departure measure |
| Industry employment for use cases | BLS CES via FRED | Monthly | 1990– | Payroll jobs | Employment level | Mixes many causes |
| AI-cited announced cuts | Challenger | Monthly | 2023– | Announcements | Workers in cuts citing AI | Unverified attributions |
| AI in restructuring filings | SEC EDGAR (8-K Item 2.05) | Continuous (we report quarterly) | 2001– | Public companies | Filings citing AI, hand-coded | Filings needn't state reasons; single coder |
| Firm AI use and headcount effect | Census BTOS | Biweekly | 2023– (break Nov 2025) | Employer firms | Use in any function; headcount change | Question change; self-report |
| Worker AI use and hours saved | St. Louis Fed RPS | Quarterly | 2024– | U.S. adults | Share of all hours saved | Self-reported; online panel |
| Worker AI use | Gallup | Quarterly | 2023– | U.S. employees | Daily/weekly use | No hours measure |
| AI-exposed employment by age | Stanford Digital Economy Lab (ADP) | Monthly | 2021– | Payroll workers | Relative employment, 22–25 | Payroll only; no unemployed |
| Exposure-adjusted unemployment-insurance claims | California AI-Unemployment Tracker | Monthly | 2024– | California claimants | Claims by exposure | One state |
| Capability | METR; vendor GDPval/OSWorld | Irregular (per model) | 2019– | Models | Time horizon; % expert-level tasks | Vendor-run; saturation; contamination |
| Usage mix (automation vs augmentation) | Anthropic Economic Index | Irregular (latest Jun 2026) | 2025– | Claude conversations | Share automating vs augmenting | One provider; not monthly |
| Hiring funnel | Greenhouse, Ashby, Huntr, LinkedIn | Irregular | Varies | Vendor customers | Applications per job/hire; interview rates | Self-selected; definitions vary |

**Not monthly** (do not present as monthly):
- CPS Contingent Worker Supplement (2005, 2017, 2023; next fielded 2026, results likely 2027)
- Displaced Worker Survey (every two years)
- BLS industry productivity (annual)
- 10-K headcounts (annual)
- MBO Partners (annual)

## 6. What cannot yet be measured

- **The capability-to-labor lag.** No common capability unit; benchmarks saturate and are contaminated (OpenAI dropped SWE-bench Verified in Feb 2026); no study estimates a lag.
- **An "AI Work Compression Ratio" from official data.** The only repeated proxy is RPS share of hours saved (2.2%), which is self-reported. Where saved hours go cannot be measured economy-wide.
- **Payroll-to-contract or fractional shifts, monthly.** No official flow measure; private estimates (MBO's 29M full-time independents) conflict with BLS (11.9M independent contractors).
- **Non-backfilled departures.** No public measure. JOLTS records hires and separations, not replacements.
- **Management layers.** Not disclosed. Manager-to-staff ratios exist only in private payroll samples (Gusto).
- **A human premium in prices or wages.** No credible willingness-to-pay data.
- **Organizational rewiring speed itself.** Adoption surveys measure use, not redesign.

## 7. Ten strongest new exhibits (ranked)

Ranked on originality, data quality, media potential, intellectual importance and updateability.

1. **White-collar long-term unemployment index with BLS-method margins.** Exists; keep as the anchor.
2. **"Beyond unemployment" white-collar panel**: involuntary part-time, multiple jobs, self-employment, hours, monthly. Added in v1.7.
3. **Announcement-vs-filing AI attribution gap, plus New York WARN AI checkbox.** Exists; add WARN in October.
4. **Three-speed evidence scorecard.** Added in v1.7; update quarterly.
5. **Hires per opening with white-collar search duration.** Exists.
6. **Nativity decomposition.** Exists; move to quarterly to protect small cells.
7. **Hours saved by AI vs hours worked** (RPS share of hours saved next to CES hours by industry). Quarterly; October candidate.
8. **Use-case watch** (deployment claims vs industry jobs series, failures included). Exists; monthly.
9. **Large-firm organizational leverage panel**: revenue, operating income, SG&A and payroll per employee for the fixed 27-firm sample, with acquisitions flagged. Annual (Q4/Q1 with 10-Ks).
10. **Hiring-loop panel**: applications per hire, interview rates, referral vs inbound conversion, from named vendors. Curated, semiannual; not a proprietary index.

## 8. Current-report additions (made in Version 1.7)

- **Chapter 01, "Beyond unemployment: is displacement hiding inside jobs?"** New exhibit from CPS microdata (above), with approximate margins of error stated as approximate.
- **Executive summary.** One "What's better" bullet: professionals keeping jobs are not being pushed into part-time, second jobs or self-employment; the adjustment is at the hiring gate.
- **Chapter 08 additions:**
  - the AI-vs-AI screening loop (Xu, Li and Jiang)
  - signal loss (Galdin and Silbert)
  - AI interviews (Jabarian and Henkel)
  - application volume (LinkedIn, Ashby)
  - retiring the "75% never seen by a human" myth
- **New feature**, "The rewiring constraint" (section 10 below), with the three-speed scorecard.
- **Future Research Agenda**: four measures (AI work compression; capability-to-labor lag; payroll-to-contract shifts; hiring-funnel congestion).
- **Appendix B**: the edition-to-edition change-record standard (section XVIII of your brief). The cover now shows "Source data available through October 2, 2026 (CPS microdata through August)."

**Deliberately not added:**
- a capability-benchmark chart (well covered elsewhere, and vendor-run)
- Bostrom (endpoint only, not empirical)
- a synthetic "hidden displacement" index (the components are better shown raw)
- any lag estimate

## 9. Future research program (start tracking monthly from October)

1. Run the white-collar "beyond unemployment" panel every month. Switch to the BLS variance parameters for these characteristics.
2. Expand the use-case watch to 8 cases, logging one setback for every success claim.
3. Add New York WARN AI-checkbox counts to the attribution-gap exhibit.
4. Each quarter:
   - update the three-speed scorecard
   - update the RPS hours-saved series next to CES hours by industry
   - update the BTOS AI-use rate (start the series at Nov 2025 to avoid the question break)
5. Each quarter, run nativity at a three-month pooled frequency.
6. **Change record**: a "What changed this edition" table in every report, plus a detailed log in the replication repository.
7. **External validation**: one labor economist and one survey statistician to review Appendix B; publish their names and scope.

## 10. Feature section (as published in Version 1.7)

## The rewiring constraint: why AI capability is outrunning organizational change

This report's central finding is fewer layoffs, longer searches. Announced layoffs are down, AI appears in only 9% of formal restructuring filings, and professionals who keep their jobs are not being pushed into part-time or contract work. Yet professionals who lose jobs stay out far longer, and each job opening yields fewer hires than in 2019 or the early 2000s. One way to read that combination is that three clocks are running at different speeds. This is a framework for reading the data, not a finding, and it builds on older ideas: Paul David's account of the electric dynamo, Erik Brynjolfsson's "productivity J-curve" and Agrawal, Gans and Goldfarb's "between times."

### Three speeds

**Capability** is moving fastest on the measures we have. METR estimates that the length of software task frontier models can complete half the time has doubled every four to seven months, from about 5 minutes for GPT-4 in 2023 to at least 16 hours in spring 2026; METR itself calls estimates above 16 hours unreliable, and the length models complete 80% of the time is only one to three hours. On OpenAI's GDPval, a test of well-specified professional tasks in 44 occupations, the share of tasks where models matched or beat experts rose from under half at its September 2025 launch to about 85% by April 2026, as reported by OpenAI. These are vendor-run, self-contained tasks, not jobs.

**Organizational rewiring** is slower. About 18–20% of U.S. firms report using AI in any business function, and roughly 95% of those report no change in headcount attributable to it (Census Business Trends and Outlook Survey, late 2025 to early 2026). Workers report more use than firms: 39% used generative AI for work in the previous week, and AI saved about 2.2% of all hours worked in the second quarter of 2026, up from 1.6% in late 2024 (St. Louis Fed Real-Time Population Survey). Use is spreading faster than redesign.

**The labor market** is adjusting on a third timescale, and mostly through hiring rather than firing. Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers (Stanford Digital Economy Lab, August 2026). The Richmond Fed finds AI-related structural change "an important but not dominant factor" in the decline in job-finding since mid-2023. Our own data add longer searches for white-collar workers who lose jobs and no sign yet of displacement hidden inside jobs.

### Task versus system

The constraint is that an AI system can perform a task without an organization being able to remove the human role around it. Roles bundle tasks with exception handling, accountability, legal responsibility, escalation, relationships and coordination, and they sit on data and legacy systems that were not built for AI. The relevant question is not whether AI can do the task, but whether the organization can redesign the whole workflow around it without losing value. History suggests that takes time: factory electrification passed half of U.S. horsepower around 1920 but raised productivity only after plants were redesigned, decades after the first power stations (David, 1990), and computers paid off mainly at firms that also reorganized work (Bresnahan, Brynjolfsson and Hitt, 2002). AI is delivered as software and may move faster; no study has yet estimated the lag from demonstrated capability to measurable job effects.

### Customer service: where the human role persists

Customer service shows the constraint clearly. In Gartner's survey of 321 service leaders (published April 2026), 85% were expanding human agents' responsibilities, even as 31% had made or planned AI-driven frontline layoffs and 63% were shrinking headcount through attrition. In a separate Gartner survey, 87% of customers said a company using generative AI for service must also offer a human agent. Klarna is the best-known case. In February 2024 it said its AI assistant handled two-thirds of customer chats, the work of about 700 agents; its November 2025 investor presentation shows company headcount falling from about 5,500 in 2022 to about 2,900, largely through a hiring freeze and attrition. In May 2025 its chief executive said cost had been "a too predominant evaluation factor" and that the result was "lower quality," and the company began piloting on-demand human agents. The case shows that automating a task is not the same as redesigning a service system. It does not show that humans "won," and there is no independent measure of Klarna's service quality.

### Direction, not only speed

Daron Acemoglu, David Autor and Simon Johnson argue that the effect on workers depends on what kind of AI firms build and buy. In "Building Pro-Worker Artificial Intelligence" (NBER, February 2026) they distinguish labor-augmenting, capital-augmenting, automating, expertise-leveling and new-task-creating technologies, and write that "only the last category is unambiguously pro-worker." Acemoglu's own macroeconomic estimate is cautious, about 0.7% higher total factor productivity over ten years; other economists estimate gains roughly ten times larger per year (Aghion and Bunel, 2024). The rewiring view is compatible with both camps: the disagreement is about how fast, and in which direction, organizations rebuild work around AI.
  
| Proposition | Evidence | Status |
|---|---|---|
| AI capability on measured tasks is rising quickly | METR time horizons; GDPval; OSWorld above human baseline (vendor-reported, 2026) | Supported, with benchmark caveats |
| Organizational adoption lags capability | ~18–20% of firms use AI; 39% of workers used it last week; 2.2% of hours saved | Consistent but unproven |
| AI-attributable headcount change is still rare | ~95% of AI-using firms report no headcount change; AI in 9% of restructuring filings | Supported |
| The labor market adjusts through hiring, not layoffs | Stanford (young workers); Richmond Fed (job-finding); NextChapter (white-collar long searches) | Supported for young workers; consistent but unproven for experienced professionals |
| Displacement is hiding inside jobs | No rise in involuntary part-time, multiple jobs or self-employment among white-collar workers | Not observed so far |
| A measurable lag from capability to job effects | No study estimates one | Not currently measurable |

  

How to read current data in this light: low counts of AI-attributed layoffs do not mean AI has no labor-market effect, and fast benchmark gains do not mean job losses are imminent. If the framework is right, effects show up first where rewiring is cheapest: positions that are not refilled, junior hiring, standardized workflows, and firms that grow without adding staff. They show up last in layoff announcements. The indicators to watch are hiring rates, search durations, hours and output per worker, not headlines about AI capability.

## 11. Revised master thesis: alternatives

1. **"Fewer layoffs, longer searches."** Keep this as the headline; it is still what the data show most clearly.
2. **"AI is changing who gets hired faster than who gets fired."** Supported for young workers in exposed jobs; consistent for experienced professionals.
3. **"Capability is fast, rewiring is slow, and the labor market adjusts at the hiring gate."** The best one-line version of the new frame. Use it as the feature's subtitle, not the report's thesis, until it is tested.
4. **"The displacement is in the search, not the job."** Backed by the v1.7 hidden-displacement check.
5. **"Growth without hiring, adjustment without layoffs."** Strong for media, but leans on the selected 27-firm sample. Use carefully.

## 12. Adversarial critique (the strongest objections)

- **Labor economist.** "Your long-search rise is cyclical: high rates, post-2021 over-hiring correction, federal cuts. The Richmond Fed itself says AI is not dominant, and Yale finds nothing. The three-speed story is unfalsifiable: any outcome can be called 'rewiring still in progress.'"
  - **Response:** agreed it is not proof. The scorecard states what would contradict it, for example rising layoffs with no hiring change, or no difference between exposed and unexposed occupations.
- **Survey statistician.** "Your white-collar cells, especially nativity and occupation splits, are small. Generalized variance functions can understate variance; you used unemployment parameters for employment characteristics; and January 2026 population controls create breaks."
  - **Response:** disclosed. Adopt the right parameters in October, pool small groups quarterly, seek external review.
- **AI researcher.** "Benchmarks you cite are vendor-run and saturating, and METR says >16 hours is unreliable. 'Capability speed' is partly a measurement artifact. Conversely, you may understate how fast agents will close the deployment gap; software diffuses faster than dynamos."
  - **Response:** both are fair. That is why the report makes no lag claim and no projection.
- **Macroeconomist.** "Acemoglu's 0.07 pp a year and Aghion and Bunel's roughly 1 pp a year bracket the debate. You can't adjudicate it with descriptive monthly data, so why include theory at all?"
  - **Response:** only to frame interpretation, kept short.
- **Skeptical journalist.**
  - "A career-transition company has a commercial interest in 'longer searches.'"
  - "Klarna and Gartner are anecdotes and leader surveys."
  - "Your 'human premium' has no price data."
  - **Response:** the commercial disclosure is at the front. We say explicitly that the Klarna case cannot show humans "won" and that no willingness-to-pay data exist.
- **Organizational economist.** "Rewiring is not one speed. It varies by firm size, sector and regulation, and some firms rewire by not hiring rather than redesigning. Your 'organizational speed' is just adoption surveys, which measure use, not redesign."
  - **Response:** correct. That is why rewiring speed is listed as not currently measurable.
- **Overall risk.** The new framing could become the story and crowd out the data. Mitigation: it lives in one feature and one scorecard; the executive summary remains about measured outcomes.

---

## Addendum (Version 1.71): the defensible capability-to-labor test

We did not correlate benchmark scores with job losses over time. That approach has too few data points, everything trends together, and benchmarks are vendor-run. Instead we ran a cross-section across occupations.

**Method**
- **Exposure measure:** the task-level LLM exposure of Eloundou, Manning, Mishkin and Rock (Science, 2024), using the GPT-4-rated β measure.
- **Weighting:** BLS OEWS employment from May 2022, aggregated to the 22 CPS occupation groups.
- **Outcomes:** CPS, January–August, comparing 2026 against two baselines, 2019 and 2022.

**Results**
- **Long-term unemployment, measured from 2022:** it rose 0.32 points in high-exposure groups vs 0.08 in low-exposure groups. The difference, +0.24 ±0.16, is beyond the margin of error. Employment-weighted r = 0.59.
- **Long-term unemployment, measured from 2019:** no difference (−0.04 ±0.15; r = 0.04). High-exposure occupations did unusually well in 2020–22, so the post-2022 gap may partly be normalization.
- **Young workers (22–27) as a share of employment:** the share falls with exposure on both baselines (r = −0.53 from 2022; −0.60 from 2019). This is the most robust result.
- **Employment:** it grew faster in exposed groups (r = 0.31).

**Turing postulate (conversational threshold)**
- **Hypothesis:** remote-conversation jobs change first after machines pass for human in conversation.
- **Customer service representatives:** employment fell 7.8% year over year (−206K ±111K).
- **Comparison group:** receptionists, who work in person, rose 3.2%.
- **Verdict:** consistent with the hypothesis, not proof.

**The degree-holding core (ages 22+)**
- **Employment:** bachelor's+ employment rose +4.5M since 2022, while non-degree employment was flat.
- **Long-term unemployment for bachelor's+:** 0.57% → 0.88%.
- **Master's holders:** +0.26 ±0.16 points vs 2025.
- **By experience:** the pattern is U-shaped. Entrants and workers with 25+ years of experience fare worst; mid-career workers fare best.
- **Openings by degree:** no official data exist. Indeed shows 19.3% of postings require a bachelor's+ (Nov 2025) and a tilt toward senior postings.

**Cost and debt (secondary sources)**
- **Price and completion:** tuition (College Board 2025) and completion (61.1%).
- **Return on investment:** FREOPP's negative-ROI shares are 23% for bachelor's and 43% for master's programs.
- **Debt and repayment:** debt figures, 10.6% of balances seriously delinquent, and 9.3M borrowers in default.
- **Policy:** OBBBA loan changes, including the end of unemployment deferment for loans made from July 2027.
- **Data gap:** no public data link student debt to employment status or unemployment duration.
