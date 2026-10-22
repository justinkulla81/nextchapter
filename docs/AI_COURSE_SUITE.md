# AI course suite

Written 2026-10-20. Design only: no course content is built. This extends `docs/AI_COURSE_DEVELOPMENT.md` (who pays, the three models, the decisions already made) with the shape of the whole catalog we could author, which courses to build first, and what each costs to build. The public side is https://launchyournextchapter.com/ai-training (offer) and https://launchyournextchapter.com/ai-skills (proof).

**How to read the numbers.** Every figure is tagged. **[Data]** comes from the postings: the nightly snapshot in the production table `AiMarketSnapshot` (row computed 2026-10-20 23:45 UTC, read-only SQL) or the static 2026-10-16 table in `src/lib/skills/ai-skill-market.data.ts`. **[Report]** comes from the White Collar Employment Report AI chapters or from Anthropic's published research, with the source named. **[Judgment]** is my call and has no data behind it. **[Estimate]** is a build-hours or price guess. A posting that asks for an AI skill is demand for the skill; it is not evidence that a course raises pay or hires anyone, and nothing here says AI caused a layoff.

## 1. Decisions this document takes as given

- First build is the Applied track, "AI in your function". Leadership is second. No public price. At most two paid builds at once (`docs/AI_COURSE_DEVELOPMENT.md`, Decisions).
- We are not an accredited provider and do not claim WIOA eligibility. We build for colleges, boards and employers, who own and run the course.
- **Curate first, build only where nothing high-quality exists (decision of 2026-10-22).** The suite is a ladder: every track at beginner, intermediate and advanced, quality over quantity. Section 10 holds the ladder. Where a verified outside course is strong we link it; where it is acceptable we say what it lacks; where there is a gap we flag it as a build. Sections 6 and 7 describe the courses we could build; section 10 says which of them are worth building.
- Delivery is rule-based, so a learner costs us nothing per head. The optional AI review of a work sample is about $0.006 per review with a $50 monthly cap across all members (`docs/AI_SKILLS.md`), stays opt-in, and is not part of any course's required path.

## 2. What the data says about demand

**Universe [Data].** 518,450 live postings; 192,488 have full text we can read; 31,958 of those (16.6%) ask for at least one specific AI skill. Counts moved from the 2026-10-16 table (172,470 postings) as the crawl grew, so shares shift by a point or two between snapshots.

**By function [Data], snapshot 2026-10-20.** "Asking" is postings with full text that name a specific AI skill. "Premium" is the posted-pay gap between postings that ask and postings that do not, raw and like-for-like within level x industry cells; it describes which postings pay more, not what a course does for a person. A dash means too few paid postings on a side.

| Function | Postings | Asking | Share | Raw premium | Like-for-like premium | Skills most asked (in order) |
|---|---:|---:|---:|---:|---:|---|
| Engineering | 54,589 | 9,211 | 16.9% | +42% | +18% ($31k) | tool use, agentic automation, LLM engineering, coding assistants |
| Data & Analytics | 16,685 | 7,766 | 46.5% | +78% | +50% ($68k) | ML general, LLM engineering, agentic automation, tool use |
| Product | 5,761 | 2,094 | 36.3% | +17% | +19% ($38.5k) | AI product mgmt, tool use, agentic automation |
| Finance | 15,431 | 1,860 | 12.1% | +38% | +16% ($27.5k) | tool use, agentic automation, assistants, governance, strategy |
| Marketing | 7,599 | 1,494 | 19.7% | +26% | +12% ($20k) | tool use, agentic automation, assistants, creative tools |
| Security | 6,617 | 1,488 | 22.5% | +52% | +8% ($15.5k) | tool use, governance, agentic automation |
| Sales | 15,579 | 1,477 | 9.5% | +23% | +15% ($24.5k) | tool use, agentic automation, transformation, governance |
| Operations | 20,601 | 1,311 | 6.4% | +51% | +27% ($39k) | tool use, agentic automation, assistants, transformation, strategy |
| Design | 2,907 | 804 | 27.7% | +37% | — | tool use, agentic automation, creative tools, prompt design |
| Human Resources | 7,993 | 778 | 9.7% | +42% | — | tool use, assistants, transformation, governance, responsible AI |
| Investment | 8,353 | 719 | 8.6% | +21% | — | tool use, agentic automation, assistants, governance |
| Strategy | 2,963 | 575 | 19.4% | +16% | — | tool use, transformation, strategy, governance |
| Legal | 5,557 | 493 | 8.9% | +50% | — | tool use, governance, assistants, responsible AI |
| Research | 2,311 | 471 | 20.4% | +50% | — | model training, ML general, tool use |
| Customer Success | 3,092 | 415 | 13.4% | +30% | — | tool use, agentic automation, assistants, analytics |
| Programs | 5,291 | 348 | 6.6% | +37% | — | tool use, agentic automation, governance, automation platforms |
| Clinical | 7,077 | 164 | 2.3% | +4% | — | tool use, AI in business apps (ambient scribe tools), assistants |
| Fundraising & development | 1,347 | 72 | 5.3% | — | — | tool use, responsible AI, assistants |
| Academic | 828 | 7 | 0.8% | — | — | tool use |

Overall, postings with posted pay that ask for an AI skill have a median of $195k against $135k for those that do not (+44% raw, +19.5% like-for-like, $33k, 3,282 postings in the like-for-like cells) **[Data]**. Postings with posted pay skew senior and well paid, so these premiums describe that slice.

**Four patterns the table supports [Data].**

1. In 18 of the 21 functions in the snapshot the single most-asked skill is "AI tools in daily work" (`a_tool_use`). The exceptions are Product (AI product management first) and Data, Research (ML skills first). Demand outside the technical functions is for using AI tools well, not building them.
2. "AI workflow automation / agents" (`a_agentic_automation`) is second or third in nearly every function, including Finance, Operations, Sales, Marketing, Programs and HR. It is the most consistent step above basic tool use.
3. Governance and responsible AI sit in the top five for Finance, Sales, Security, Legal, HR, Programs and Strategy. It is a cross-cutting ask, not a legal-only one.
4. Operations has the lowest share among the large functions (6.4%) yet the largest like-for-like gap ($39k), and has 20,601 postings, the biggest non-engineering pool. Share asking is low, so the signal is early, not absent **[Judgment on how to read it]**. Section 3 qualifies this: the Anthropic Economic Index puts most operations occupations at low observed exposure.

**By level [Data].** The snapshot keeps level only inside paid-posting premium cells, so it cannot size entry-level demand. Paid postings with a stated level: senior 4,953 (53% ask for AI), manager 3,479 (38%), director 2,828 (38%), mid 2,244 (39%), early 1,652 (30%), VP 327 (46%), entry 177 (19%, only 34 ask). Only 177 paid entry-level postings exist in these cells, so I do not read an entry-level demand number from them. The share is of paid postings, which is not the share of all postings.

**New-worker context [Report].** Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers (Stanford Digital Economy Lab, Aug 2026); firms using AI grew senior roles 32% and junior roles 6% against non-adopters (Revelio, Aug 2026); senior postings rose 14.7% and entry-level fell 7.5% over the year to May 2026 (Indeed Hiring Lab). Within a job, AI helps the least experienced most: customer-support agents gained 34% against 14% on average (Brynjolfsson, Li, Raymond, QJE 2025). The report's own reading: the measurable effect is at the entry gate, through hiring, and is consistent with but does not prove AI as the cause.

**Retraining context [Report].** The federal Dislocated Worker program served about 187,000 people in its latest year and about one in five received training. Among unemployed white-collar workers aged 55–64, 39% have searched 27 weeks or more. 30% of adults 50+ use AI (AARP, Dec 2025). Public retraining is small next to the number of long searches.

**By industry [Data, partial].** The snapshot has no industry breakdown (its `dimensions` block is absent), so industry shares asking are not available. The static table gives posting volume per function x industry cell (1,000+ postings only), which shows where an industry lens would reach the most postings: financial services (investment 3,786, engineering 3,736, finance 3,176, sales 1,431, operations 1,132), healthcare (clinical 4,548, engineering 2,424, operations 1,830, people 1,007), industrial (engineering 9,352, operations 2,862, sales 1,988, finance 1,530), technology (engineering 15,606, data 4,991, sales 3,720), life sciences (engineering 2,030, clinical 1,130, operations 1,095). Government appears only once (engineering, 1,091), which is a crawl-coverage gap more than evidence of low demand **[Judgment]**.

**What the existing catalog already covers [Data].** Of the 24 skills, third-party courses are densest on tool use (9 courses), prompt design (8) and assistants (7), and thinnest on AI-enabled analytics (1), AI product management (1), RAG (1), GPU (1), adoption and change (2), automation platforms (2), AI in business apps (2), creative tools (2), coding assistants (2) and leading AI teams (0). The free catalog does not need a rival on basic tool use. The gaps we can fill are function-specific practice with a work sample, adoption and change for managers, automation for non-engineers, and analytics.

## 3. Anthropic Economic Index matched to the jobs on our board

**What the index adds.** Section 2 measures what employers ask for. The Anthropic Economic Index measures a different thing: how much of each occupation's work people are already doing with Claude. The occupation-level file (`labor_market_impacts/job_exposure.csv` in https://huggingface.co/datasets/Anthropic/EconomicIndex, released under the MIT license, 756 occupations) gives an "observed exposure" per O*NET occupation. As Anthropic defines it (https://www.anthropic.com/research/labor-market-impacts), it combines O*NET task lists, an early-2023 estimate of which tasks an LLM could speed up, and Claude usage from August and November 2025, counting fully automated use at full weight and assisted use at half, averaged over the occupation's tasks by time spent. Computer Programmers score 0.75, Customer Service Representatives 0.70, Data Entry Keyers 0.67. 411 of the 756 occupations score zero because their tasks barely appear in the usage data. It describes Claude usage only, it is not a forecast of job loss, and Anthropic reports no systematic rise in unemployment among highly exposed workers, with suggestive evidence of slower hiring of 22 to 25-year-olds in exposed occupations **[Report: Anthropic, 5 March 2026]**.

**How the match was made [Data].** Each live posting on the board carries a crawler-assigned O*NET code (`ExclusiveJobPosting.socCode`). I truncated it to six digits and joined it to the index, using the same "live" definition as the nightly snapshot (approved, not archived, not expired, no internships). 372,238 live postings carry a code; 348,510 of them (93.6%) match one of 549 occupations in the index. The rest sit on codes the index does not list (largest: Project Management Specialists 9,032; Sales Representatives of Services 8,933; Fundraising Managers 1,804) and are left out. The crawler's code assignment has not been audited **[Judgment: treat occupation-level rows under about 200 postings as indicative]**. The joined table is [docs/data/ai_exposure_by_occupation_2026-10-22.csv](docs/data/ai_exposure_by_occupation_2026-10-22.csv).

### 3.1 Employers ask for AI where Claude is already used

| Observed exposure of the occupation | Occupations | Live postings | Share of matched postings | Full-text postings asking for an AI skill | Entry or early-level share of live postings |
|---|---:|---:|---:|---:|---:|
| 0 | 231 | 16,714 | 4.8% | 5.7% | 22% |
| Above 0 to 0.10 | 143 | 114,719 | 32.9% | 8.5% | 26% |
| 0.10 to 0.25 | 92 | 66,648 | 19.1% | 12.9% | 23% |
| 0.25 to 0.40 | 48 | 107,974 | 31.0% | 30.2% | 23% |
| 0.40 and above | 35 | 42,455 | 12.2% | 25.5% | 48% |

Across the 110 occupations with 200 or more full-text postings, exposure and the share asking for AI move together (Spearman correlation 0.43). The top two bands are carried by technical occupations (Software Developers 42% ask, Data Scientists 62%). Excluding all computer and math occupations, the 66 occupations at 0.25 or above hold 80,551 live postings and 17.2% of their full-text postings ask for an AI skill **[Data]**.

### 3.2 Where exposure is high and the asks are not yet there: the retraining gap

Define the gap as occupations with observed exposure of 0.25 or more where fewer than 15% of full-text postings name an AI skill, computer and math occupations excluded. That is **51 occupations, 48,600 live postings, 17,259 of them entry or early level [Data; the 0.25 and 15% cut-offs are my choice]**. The largest:

| Occupation (O*NET code) | Exposure | Live postings | Ask for an AI skill | Entry or early | Course in this suite |
|---|---:|---:|---:|---:|---|
| Financial Managers (11-3031) | 0.39 | 14,244 | 9.8% | 49 | 3 Finance |
| Accountants and Auditors (13-2011) | 0.35 | 7,863 | 9.0% | 3,557 | 3 Finance |
| Financial and Investment Analysts (13-2051) | 0.57 | 5,707 | 14.5% | 2,070 | 3 Finance |
| Paralegals and Legal Assistants (23-2011) | 0.29 | 2,313 | 6.8% | 1,900 | none yet (legal pack, later) |
| First-Line Supervisors of Retail Sales (41-1011) | 0.26 | 2,190 | 0.8% | 7 | 5 Sales |
| Secretaries and Administrative Assistants (43-6014) | 0.45 | 2,111 | 6.0% | 2,043 | 12 Office and administrative |
| Sales Reps, Wholesale and Manufacturing (41-4012) | 0.63 | 1,774 | 0.5% | 1,633 | 5 Sales |
| Securities and Financial Services Sales Agents (41-3031) | 0.44 | 1,715 | 4.7% | 347 | 5 Sales, 3 Finance |
| Personal Financial Advisors (13-2052) | 0.35 | 1,474 | 1.9% | 589 | 3 Finance |
| Training and Development Managers (11-3131) | 0.38 | 1,230 | 12.1% | 114 | 10 Leading teams |
| Bookkeeping and Accounting Clerks (43-3031) | 0.31 | 999 | 4.8% | 849 | 3 Finance |
| Public Relations Specialists (27-3031) | 0.45 | 805 | 11.9% | 634 | 6 Marketing |

How to read it: Claude is already used on a large part of these occupations' tasks, and the postings for them mostly do not yet name an AI skill. That is a measured gap between usage and what employers write down. It is not evidence that the people in these jobs will lose them, and it is not evidence that a course changes what they are offered.

### 3.3 The index against each course

Occupations assigned to each course by my own grouping of O*NET codes **[Judgment]**; figures from the join **[Data]**.

| Course | Live postings | Mean exposure (weighted by postings) | Ask for an AI skill | Entry or early share | Reading |
|---|---:|---:|---:|---:|---|
| 3 Finance and accounting | 38,403 | 0.36 | 9.5% | 29% | High exposure, low asks, large volume. The clearest case for a first build |
| 6 Marketing and content | 23,762 | 0.37 | 30.4% | 25% | High exposure and asks already common; competes with employers training their own people |
| 7 HR and talent | 16,385 | 0.24 | 13.7% | 35% | Moderate exposure, low asks, the highest entry and early share of the function courses |
| 5 Sales and customer success | 33,068 | 0.16 | 10.4% | 32% | Mean is held down by Sales Managers (0.04, 21,639 postings); wholesale and securities sales roles are 0.44 to 0.63 with near-zero asks |
| 4 Operations and programs | 40,805 | 0.12 | 7.1% | 20% | Large volume, low exposure. Weaker case than the posting premium alone suggested |
| 9 Analytics with AI | 13,957 | 0.38 | 64.3% | 25% | Dominated by data science postings that already ask; the opening is for non-specialists who read reports |
| 12 Office and administrative | 3,613 | 0.35 | 4.8% | 90% | Most exposed, nearly all entry or early, almost absent from our board |
| Legal support (not yet a course) | 10,286 | 0.20 | 11.5% | 26% | Paralegals 0.29 and 6.8% ask |
| Health administration and records (not yet a course) | 7,720 | 0.08 | 2.6% | 1% | Medical Records Specialists 0.67 but only 164 postings |
| Software and IT (third-party catalog) | 62,090 | 0.33 | 34.2% | 25% | Not a first-build target |

### 3.4 What this changes in the design

1. **Finance stays first, with a firmer reason.** It combines the biggest exposed pool outside technology with the lowest ask rate, and its entry and early postings (11,183) give the new-worker course something to point at.
2. **Operations moves down.** Section 2's like-for-like pay gap in operations postings is real, but the index puts most operations occupations at low observed exposure (mean 0.12). Operations and programs become the last function course in the sequence.
3. **HR moves up** to sit with marketing. It is the only function course with moderate exposure, low asks and a 35% entry and early share.
4. **Add a twelfth course for office, administrative and customer-support roles.** Anthropic's most exposed occupations are clerical and service roles: Customer Service Representatives 0.70, Data Entry Keyers 0.67, Medical Records Specialists 0.67, Medical Transcriptionists 0.64, Secretaries and Administrative Assistants 0.45. Our board holds only 173 live postings for the first, 22 for the second, 164 for the third and 1 for the fourth, so the board cannot size this audience. The audience is the worker those roles employ and the workforce board that serves them. Build it only on a signed scope **[Judgment]**.
5. **Entry-level matters more in the exposed occupations.** Entry and early-level postings are 30% of live postings in occupations at 0.25 or above, against 25% below it, and 6.6% of them name an AI skill against 2.4% below **[Data]**. This supports the new-worker course (2) as a real audience on our own board, which section 2 could not show.
6. **The nightly job should carry the index.** A static copy of `job_exposure.csv` plus one grouped query would add exposure bands and the gap list to the `AiMarketSnapshot`, so this section updates itself. That is a small build, not part of this design.

## 4. Taxonomy of a comprehensive suite

A course is a cell in five axes. We do not build the cross-product: a course is a **core** plus a **function pack** plus an optional **industry lens**, so one build serves many cells.

### Axis A: function (what the learner does all day)

Applied function courses, each the same spine (section 6): Finance and accounting; Operations and program management; Sales and customer success; Marketing and content; Human resources; Legal and compliance (later, tool set differs: Harvey/CoCounsel class); Product; Design; Clinical and healthcare administration (later, low posting share today at 2.3%). Builder functions (Data & Analytics, Engineering, Security, Research) are served by the third-party catalog and by learners moving into them, not by our first builds **[Judgment]**.

### Axis B: organizational skill set (what the learner is responsible for)

| Level | Responsible for | Skills (24-item ids) |
|---|---|---|
| Individual contributor | Doing their own work with AI, producing evidence | `a_tool_use`, `a_assistants`, `a_prompt`, `a_agentic_automation`, `a_automation_tools`, `a_ai_analytics` |
| Manager | Redesigning a team's work, setting norms, measuring | `l_transformation`, `l_strategy`, `l_responsible` |
| Executive | Choosing where AI goes, funding, risk appetite | `l_strategy`, `l_governance`, `l_ai_product` |
| Org-wide adoption and governance | Policy, inventory of use, controls, training the workforce | `l_governance`, `l_responsible`, `l_transformation`, `b_eval` (as a buyer of evaluation, not a builder) |

### Axis C: general tools and foundations

Using a general assistant well (ChatGPT, Microsoft Copilot, Claude, Gemini), prompt design, checking AI output, data handling and confidentiality, and the tool-specific tracks employers name most. Tools named most across postings **[Data]**: Microsoft Copilot, Claude, ChatGPT, Gemini, Gong, Power Automate, Zapier, Agentforce, GitHub Copilot, Cursor. **Tool churn rule [Judgment]:** teach the task and the checking habit on a named tool, and keep every tool-specific screen in a replaceable lab module.

### Axis D: industry (lens packs, not courses)

Financial services, healthcare, industrial and manufacturing, technology, life sciences, public sector. A lens pack is 1 to 2 hours: the industry's regulated data, the tools its postings name, two industry practice tasks. Priority by posting volume above: financial services, healthcare, industrial **[Data for volume, Judgment for priority]**.

### Axis E: learner type

| Learner | Starting point | What they need | Best course shape |
|---|---|---|---|
| Displaced professional retraining | 10+ years in a function, out of work, often long search | Credible, current evidence in their own function fast; not a new career | Function course (6 to 8 h) plus a finished work sample, delivered in a 2 to 4 week cohort |
| New worker / entry-level | Student or recent graduate, no portfolio | AI as a visible working skill plus 2 or 3 samples employers can open | Foundations plus a launch lab, sold through the college |
| Career changer | Experienced in one function, entering another | The function's AI practices and vocabulary | A function course in the target function with a bridge module |
| Current employee | Employed, employer is adopting AI | Role-specific practice inside their company's approved tools | Function course, employer-branded, 2 to 4 weeks, manager track alongside |

## 5. Coverage matrix

Rows are the proposed courses (section 6). Columns: the posting signal behind the course, the Anthropic Economic Index reading from section 3 (mean observed exposure of the course's occupations), and the learner types it fits. "Demand" is rated from the data in sections 2 and 3 where a number exists; the rating itself is **[Judgment]**.

| # | Course | Postings behind it [Data] | Index exposure [Data] | Demand | Displaced | New worker | Changer | Employee |
|---|---|---|---|---|:-:|:-:|:-:|:-:|
| 1 | AI foundations for working professionals | Tool use is the top ask in 18 of 21 functions | n/a | Strongest | ● | ● | ● | ● |
| 2 | AI-ready launch (new workers) | 177 paid entry postings, 34 ask; [Report] entry-gate evidence | 30% entry or early in exposed occupations | Strong on [Report], thin on [Data] | | ● | | |
| 3 | AI in finance and accounting | 15,431 postings, 1,860 ask (12.1%) | 0.36 | Strongest in the first wave | ● | | ● | ● |
| 4 | AI in operations and programs | 20,601 + 5,291 postings, 1,311 + 348 ask; largest like-for-like gap ($39k) | 0.12 | Medium: large volume, low exposure | ● | | ● | ● |
| 5 | AI in sales and customer success | 15,579 + 3,092 postings, 1,477 + 415 ask | 0.16 | Medium-strong | ● | | ● | ● |
| 6 | AI in marketing and content | 7,599 postings, 1,494 ask (19.7%) | 0.37 | Strong | ● | | ● | ● |
| 7 | AI in HR and talent | 7,993 postings, 778 ask (9.7%) | 0.24 | Medium | ● | | ● | ● |
| 8 | Automation and agents for non-engineers | `a_agentic_automation` is top 2 or 3 in nearly every function | n/a | Strongest cross-cutting | ● | | ● | ● |
| 9 | Analytics with AI | `a_ai_analytics` in top 8 of Ops, Sales, Marketing, Strategy, Customer Success; 1 third-party course | 0.38 | Medium, a catalog gap | ● | ● | ● | ● |
| 10 | Leading teams through AI | `l_transformation` and `l_strategy` in Finance, Ops, Sales, HR, Strategy; director and manager postings 2,828 and 3,479 with pay | n/a | Strong at senior levels | ● | | | ● |
| 11 | AI governance and responsible use | `l_governance` top 5 in Finance, Sales, Security, Legal, HR, Programs, Strategy | n/a | Medium-strong | ● | | ● | ● |
| 12 | AI in office, administrative and customer-support roles | Index: Customer Service Representatives 0.70, Secretaries and Administrative Assistants 0.45; board holds only 3,613 live postings in these roles, 90% entry or early, 4.8% ask | 0.35 | Strong on the index, unsized on the board | ● | ● | ● | ● |

Not in the first twelve, by design: Builder courses (the free catalog covers them and they sell to a different buyer); legal, clinical, design and product function packs (add after the template proves out); an executive-only course (served as a short format of course 10, below).

## 6. Proposed initial courses

All function courses share one spine so the template is built once: (1) the AI skills this function's postings ask for most, generated from the data so the course updates when the data does; (2) three practice tasks on realistic work; (3) one finished work sample that is recorded as evidence on the member's profile (`src/lib/evidence/ai-work-samples.ts`); (4) a rule-based assessment. Length is learner time. Format "self-paced" means no instructor; "cohort" means a facilitator, a start date and a final review.

**Funding column.** What typically pays, stated as a pattern I would test, not as a verified program list for any state **[Judgment; the WIOA and Workforce Pell rules need counsel confirmation before they go in a proposal]**.

### 1. AI foundations for working professionals

- **Learner:** any of the four types; the default first module in every other course.
- **Outcome:** uses a general assistant to draft, analyze and check work; writes a reusable prompt; spots and fixes a wrong answer; handles confidential data correctly.
- **Prerequisite:** none.
- **Length and format:** 4 hours, self-paced.
- **Assessment and work sample:** rule-based scenario checks (identify the error in an AI draft, choose what may be pasted into a tool); work sample is a before-and-after of one real task with the prompt shown.
- **Skills:** `a_tool_use`, `a_assistants`, `a_prompt`, `l_responsible`.
- **Buyer and funding:** employer (L&D or tuition budget, as an all-staff pre-read); college (continuing education, alumni programs); board (as the first module of a customized training contract). Price pressure is high because free equivalents exist (Claude 101, AI Fluency, Copilot paths are in the catalog); sell it bundled, not alone.

### 2. AI-ready launch for new workers

- **Learner:** students and recent graduates, workers under two years in a role.
- **Outcome:** three artifacts a hiring manager can open: an AI-assisted work product with the checking shown, an automation with a before and after, and a short note on where they would not use AI.
- **Prerequisite:** Course 1 or equivalent.
- **Length and format:** 10 hours over 3 weeks, cohort with peer review.
- **Assessment and work sample:** rubric on each of the three artifacts (rule-based checks), plus a portfolio page.
- **Skills:** `a_tool_use`, `a_prompt`, `a_agentic_automation`, `a_creative`.
- **Buyer and funding:** college career services office (the budget this one is aimed at), paid from student-success or career-readiness lines; workforce board youth and young-adult programs under contracted training (eligibility rules differ by program and state). Evidence for demand is the [Report] entry-gate research; the posting data cannot size it.

### 3. AI in finance and accounting

- **Learner:** accountants, FP&A, controllers, analysts; the largest pool of displaced white-collar finance workers we reach.
- **Outcome:** produces a variance commentary, a reconciliation check, and a month-end narrative with an AI assistant in spreadsheet and Copilot workflows, and documents what a reviewer must verify.
- **Prerequisite:** Course 1; working knowledge of financial statements.
- **Length and format:** 6 hours self-paced, or a 3-week cohort with a review session.
- **Assessment and work sample:** scored on a seeded set of errors the learner must catch; work sample is the variance commentary with its verification log.
- **Skills:** `a_tool_use`, `a_assistants`, `a_agentic_automation`, `l_governance` (top-5 asks for Finance **[Data]**), `a_automation_tools`.
- **Buyer and funding:** college (executive education, accounting-society CPE arrangements); employer finance teams (L&D); board (dislocated-worker contracted training).

### 4. AI in operations and program management

- **Learner:** operations managers, analysts, project and program managers.
- **Outcome:** maps a recurring process, finds the steps AI can take over, builds a process document and a status report with an assistant, and sets the check points.
- **Prerequisite:** Course 1.
- **Length and format:** 6 hours self-paced; 3-week cohort for employers.
- **Assessment and work sample:** process-redesign scenario checked against a rubric; work sample is a before-and-after process map.
- **Skills:** `a_tool_use`, `a_agentic_automation`, `a_automation_tools`, `l_transformation`, `a_ai_analytics`.
- **Buyer and funding:** employer (operations excellence and L&D); board (customized or incumbent-worker training, where state rules allow); college continuing education.

### 5. AI in sales and customer success

- **Learner:** account executives, SDRs, customer success managers, support leads.
- **Outcome:** research an account, draft outreach and call follow-ups, summarize a call, and set rules on what is not sent without review.
- **Prerequisite:** Course 1.
- **Length and format:** 6 hours self-paced.
- **Assessment and work sample:** accuracy checks on AI-drafted outreach against supplied account facts; work sample is an account plan with its sources.
- **Skills:** `a_tool_use`, `a_assistants`, `a_agentic_automation`, `a_ai_analytics`, `a_enterprise_ai`.
- **Buyer and funding:** employer sales enablement budget; college continuing education; board (contracted training).

### 6. AI in marketing and content

- **Learner:** marketers, communications, content and brand teams.
- **Outcome:** produces a campaign brief, variants and a measurement plan with an assistant and creative tools, and keeps brand and disclosure rules.
- **Prerequisite:** Course 1.
- **Length and format:** 6 hours self-paced.
- **Assessment and work sample:** rubric on brand, factual accuracy and disclosure; work sample is a campaign package.
- **Skills:** `a_tool_use`, `a_assistants`, `a_creative`, `a_prompt`, `a_ai_analytics`.
- **Buyer and funding:** employer marketing L&D; college continuing education and alumni; board (contracted training).

### 7. AI in human resources and talent

- **Learner:** HR generalists, recruiters, learning and development staff.
- **Outcome:** uses an assistant for job descriptions, policy drafts and onboarding material, and knows where automated screening and employment-decision rules apply.
- **Prerequisite:** Course 1.
- **Length and format:** 6 hours self-paced.
- **Assessment and work sample:** scenario checks on what may and may not be automated; work sample is a policy-aware drafted package.
- **Skills:** `a_tool_use`, `a_assistants`, `l_responsible`, `l_governance`, `l_transformation`.
- **Buyer and funding:** employer HR/L&D; college continuing education; board staff development. The compliance content (screening, bias-audit rules) must be written or reviewed by counsel before sale **[Judgment]**.

### 8. Automation and agents for non-engineers

- **Learner:** analysts and operators in any function.
- **Outcome:** builds and documents one automation on a mainstream no-code platform (Power Automate, Zapier or n8n), including the failure case and a human check.
- **Prerequisite:** Course 1.
- **Length and format:** 8 hours; self-paced labs plus an optional live clinic.
- **Assessment and work sample:** the automation passes a fixed test set the learner runs; work sample matches the existing "AI automation with a before and after" type.
- **Skills:** `a_agentic_automation`, `a_automation_tools`, `a_tool_use`.
- **Buyer and funding:** employer; college continuing education; board (customized training). **Highest tool-churn exposure of the set**, so keep platform steps in replaceable lab modules.

### 9. Analytics with AI

- **Learner:** anyone who reads or builds reports: finance, operations, marketing, strategy.
- **Outcome:** asks a data question in plain language, validates the answer against the source, builds a chart and a short written finding with the limits stated.
- **Prerequisite:** Course 1; spreadsheet fluency.
- **Length and format:** 8 hours self-paced.
- **Assessment and work sample:** checks that the learner catches seeded data errors; work sample is a validated finding.
- **Skills:** `a_ai_analytics`, `a_tool_use`, `a_assistants`.
- **Buyer and funding:** college (it also supports the "data analytics certificate" idea in `PROGRAM_IDEAS`); employer; board.

### 10. Leading teams through AI

- **Learner:** managers and directors; with a 2-day format, executives.
- **Outcome:** picks use cases, redesigns a team's roles and handoffs, sets usage norms and review rules, and defines what to measure. Produces a 90-day adoption plan.
- **Prerequisite:** Course 1 or equivalent practice; people-management experience.
- **Length and format:** 12 hours over 4 weeks cohort; also a 2-day executive format with the same material.
- **Assessment and work sample:** the adoption plan is scored against a rubric and matches the existing "AI policy or use-case portfolio" type.
- **Skills:** `l_transformation`, `l_strategy`, `l_responsible`, `l_governance`. Note `l_ai_org_lead` (heads of AI) stays out: the audience here is managers using AI, not leaders of AI teams.
- **Buyer and funding:** college executive education arms (the direct fit with `PROGRAM_IDEAS` "Leading teams through AI"); employer leadership development; board only for dislocated managers.

### 11. AI governance and responsible use

- **Learner:** compliance, risk, legal, IT and operations staff who write or enforce AI policy; also any manager signing off use cases.
- **Outcome:** builds an AI use inventory, classifies uses by risk, drafts acceptable-use rules and a review checklist mapped to the NIST AI Risk Management Framework.
- **Prerequisite:** Course 1.
- **Length and format:** 8 hours self-paced, or a 2-week cohort.
- **Assessment and work sample:** policy and inventory scored on a rubric; matches the existing "AI policy or use-case portfolio" type.
- **Skills:** `l_governance`, `l_responsible`, `l_strategy`.
- **Buyer and funding:** employer (risk and compliance budget); college professional education; board rarely. The catalog already points to NIST, IAPP AIGP and ISACA AAIA; ours is the applied, assessed layer before those certifications.

### 12. AI in office, administrative and customer-support roles

- **Learner:** administrative assistants, office and records clerks, customer service and support staff, medical records and transcription staff; displaced or at risk of search, and new workers entering these roles.
- **Outcome:** drafts correspondence, summarizes calls and tickets, handles scheduling and data cleanup with an assistant, and states what a person must still check or decide.
- **Prerequisite:** none beyond Course 1.
- **Length and format:** 6 hours self-paced, or a 2-week cohort.
- **Assessment and work sample:** scenario checks on accuracy, confidentiality and escalation; work sample is a before-and-after of one real task with its checks.
- **Skills:** `a_tool_use`, `a_assistants`, `a_prompt`, `a_automation_tools`.
- **Buyer and funding:** workforce board (the likeliest payer, for dislocated-worker and incumbent-worker training); employer back-office and contact-center L&D; community college continuing education. The demand evidence is the Anthropic index, not our postings, which hold few of these roles **[Judgment]**.

## 7. Recommended sequence and build effort

**Estimates, not quotes.** Baseline is the 80 to 120 hours per six-hour self-paced course in `docs/AI_COURSE_DEVELOPMENT.md`. Hours cover design, content, assessment items, work-sample rubric, a pilot read-through and revisions, not sales time. The first function course carries the shared template and the Foundations core; later function courses are cheaper because they reuse both.

| Wave | Course | Estimated build hours | Why here |
|---|---|---:|---|
| 1 | 3. AI in finance and accounting, **plus the shared template and Course 1 core** | 140 to 180 | Finance is the largest non-technical function with AI asks (1,860 postings) and a tool set (Copilot, spreadsheets) that is stable. Building it forces the template, assessment engine and Course 1 content into existence once. Course 1 then ships with little extra work |
| 1 | 1. AI foundations, packaged standalone | +10 to 20 | Mostly extracted from Wave 1 |
| 2 | 10. Leading teams through AI | 100 to 140 | Decided second build; sells to college executive education; cohort format needs a facilitator guide |
| 3 | 6. Marketing and content | 60 to 90 | Exposure 0.37 and asks already at 30%: employers are hiring for it now. Template reuse |
| 3 | 8. Automation and agents for non-engineers | 90 to 120 | Top-2 or 3 ask in nearly every function; sells alongside every function course. Highest tool churn |
| 4 | 7. AI in HR and talent | 70 to 100, plus counsel review | Exposure 0.24, asks 13.7%, 35% entry or early; compliance content must be reviewed first |
| 4 | 5. Sales and customer success | 60 to 90 | Template reuse; wholesale and securities sales roles are exposed with near-zero asks |
| 5 | 11. AI governance and responsible use | 80 to 110 | Cross-cutting ask; needs counsel review |
| 5 | 2. AI-ready launch (new workers) | 90 to 130 | Needs a college partner to shape; peer review adds design time. 17,259 entry or early postings sit in the retraining-gap occupations |
| 5 | 9. Analytics with AI | 90 to 120 | Needs clean practice datasets |
| 6 | 4. Operations and programs | 70 to 100 | Largest posting pool but low index exposure (mean 0.12); reuses template |
| 6 | 12. Office, administrative and customer-support | 70 to 100 | Built only on a signed scope, typically a workforce board; demand evidence is the index, not our board |

Total for all twelve: about 930 to 1,300 hours **[Estimate]**. Waves 1 and 2 together: about 250 to 340 hours.

**Ordering rules.**

- **A signed scope beats the order.** The sequence is the default. If a college or board signs for a different course, that course jumps the queue, subject to two paid builds at once.
- **Waves 1 and 2 are the two concurrent paid-build slots.** Do not start Wave 3 while either is unshipped.
- **No build starts without a signed scope**, per `docs/AI_COURSE_DEVELOPMENT.md` (First 30 days, step 4). A build-first exception for Course 1 costs about 40 to 60 hours **[Estimate]** and makes sense only if the first quote stalls on "show me a sample"; that is a decision for the owner.

## 8. Which buyer for which course

| Buyer | Courses to lead with | What the first conversation offers |
|---|---|---|
| College (continuing education, alumni, executive education) | 10, 3, 1, 9 | The alumni AI-gap measurement first, then a quote. Executive education buys 10. Career services buys 2 |
| Workforce board / American Job Center | 1, 3, 4, 8, 2 | A grant-partner role in a specific notice when one opens; otherwise contracted training for dislocated workers. No speculative grant chasing |
| Employer | 10, 11, 4, 8 and its own function | Per-participant cohort license; AI skills inside a transition package for layoff employers |

On the leading job transition platform the member profile records each work sample as evidence, so a buyer sees completion and finished work, not attendance alone.

## 9. Open questions and risks

1. **Accreditation and WIOA eligibility.** We are not accredited. WIOA individual training accounts need a state eligible training provider list entry, which a college partner can hold. Workforce Pell goes to accredited institutions and, as I understand it, to programs of 150 to 599 clock hours, which none of these 4 to 12 hour courses meets alone **[Judgment; confirm before any proposal says so]**. Question for counsel and a partner college: can a bundle of several courses, with an accredited college as the provider of record, qualify?
2. **Outcome claims.** Postings asking for a skill is demand. Do not state that a course raises pay, hires faster or protects a job. Proposals may cite the posting counts and the premium as a description of postings, with the controls named. This applies to Course 2 hardest, where the evidence is about hiring at the entry gate.
3. **Entry-level demand cannot be sized from our data.** 177 paid entry postings is too few. Before pricing Course 2, decide whether a level breakdown over all postings, not just paid ones, is worth adding to the snapshot.
4. **No industry breakdown in the snapshot.** The snapshot's `dimensions` block is absent, so industry lens priority rests on posting volume, not on share asking. A one-query change to the nightly job would add it.
5. **Tool churn.** Named tools change within months. Keep tool screens in replaceable lab modules, review each course every quarter, and give each course an owner and a review date. Course 8 carries the most risk.
6. **Cost per learner.** Required path costs nothing per learner (rule-based checks). Practice tasks use the learner's own assistant account; a free tier that disappears becomes a learner or buyer cost. The optional AI review is about $0.006 per review under a $50 monthly cap; at 1,000 learners reviewing three samples each that is about $18, inside the cap **[Estimate from the measured per-review cost]**. Any new feature that calls a model per learner needs its cost line first.
7. **Automated-decision rules.** Course 7 touches NYC Local Law 144 and similar rules, and the AI review is member-only until counsel has looked at them (`docs/AI_SKILLS.md`). Same counsel pass for both.
8. **Ownership of the course.** Under course development the buyer owns and runs the course. Decide in advance whether we keep the right to reuse the shared template and Course 1 core across buyers. Without it, Waves 3 to 5 cost much more.
9. **Capacity.** At 100 to 180 hours per build, two concurrent builds is roughly 6 to 10 working weeks of one person for Waves 1 and 2. Any additional hour sold must fit that.
10. **Anthropic Economic Index limits.** Observed exposure measures Claude usage only, weights it by an early-2023 estimate of which tasks a model could speed up, and covers August and November 2025 usage. Anthropic states it is not a forecast of job loss. Our match depends on the crawler's O*NET codes, which are not audited, and 23,728 live postings sit on codes the index does not list. Cite it as a measure of where usage is, never as evidence that AI caused or will cause a loss of jobs, and attribute it to Anthropic. The folder is MIT-licensed per the dataset page; confirm the terms before republishing the numbers outside this document.
11. **Our board under-represents the most exposed clerical and service roles** (173 Customer Service Representative, 22 Data Entry and 1 Medical Transcriptionist live postings). Retraining need for those audiences cannot be sized from our data.
12. **Placeholder prices.** Nothing here sets a price. The $15,000 to $40,000 development range and $150 to $400 per participant range in `docs/AI_COURSE_DEVELOPMENT.md` are still unverified placeholders.

## 10. The ladder: curate, accept a trade-off, or build

**Method.** Three researchers each opened the actual course pages (over 100 searches and page fetches in total, 2026-10-22) and scored candidates against one rubric: current, credible provider, hands-on practice, assessment or credential, role-specific tasks, teaches checking AI output, honest time, price and access. I re-opened four of the highest-stakes claims myself (ACCA certificate, DeepLearning.AI prompting course, NALA paralegal course, Microsoft Copilot for Finance module) and all four matched. Everything else is as reported by the researchers and is marked "not verified" where they could not see it. Prices and dates are as shown on 2026-10-22 and change.

**Levels, defined by the learner's AI skill and not by seniority.** *Beginner*: has never used an assistant for work, or only tried it. *Intermediate*: uses an assistant most days, writes reusable prompts, wants reliable workflows and checking habits. *Advanced*: builds multi-step automations or agents, evaluates output systematically, sets policy or leads adoption.

**Verdicts.** **Strong**: link it as it is. **Trade-off**: usable, with the stated weakness. **Gap**: nothing good found; the build note says what a purpose-built course must contain.

### 10.1 What the research found across every track

1. **Almost no course teaches checking AI output as a graded skill.** Researchers found it described as a real taught and assessed skill in none of the finance, legal, sales, marketing, automation, data or coding courses they opened. Most pages state it as an outcome at best. This matters most in finance and legal, where an unchecked number or citation is the failure.
2. **Beginner is well supplied; the middle and the top are thin.** Strong or acceptable free beginner courses exist in almost every track. Intermediate is mostly vendor-locked. Advanced for non-engineers barely exists.
3. **Most good material is tied to one vendor** (Microsoft Copilot, Salesforce, Zapier, HubSpot) and several need paid licences or are restricted to customers or students.
4. **Dates are rarely shown.** Only Microsoft Learn and DeepLearning.AI pages showed an update date. Every curated link needs a recheck on a schedule.
5. **Free access and credentials are unstable.** DeepLearning.AI's Claude Code course is free "for a limited time"; its graded work and certificates for the prompting and agentic courses need a Pro plan ($25 to $30 a month).

### 10.2 The ladder

Cell format: best pick, then verdict. "NV" means not verified. Full URLs are in section 10.3.

| Track | Beginner | Intermediate | Advanced |
|---|---|---|---|
| **Foundations** | Anthropic AI Fluency (free, final assessment, certificate); DeepLearning.AI AI Prompting for Everyone (7h04m, updated July 2026, 3 graded assignments on Pro). **Strong** | OpenAI Academy Apply AI at Work; Claude 101. Hours, assessment and certificate not verified. **Trade-off**: no reusable-prompt-plus-verification course with graded work | Nothing for non-engineers. **Gap** |
| **Office, admin, customer support** | Microsoft AI Fluency path (free, quizzes, badges, not admin-specific); Google AI Essentials (about 8 to 10h, $49/month). **Trade-off** | Salesforce AI Agent Course (free, builds agents, Salesforce-specific). **Gap** | None found. **Gap** |
| **HR and talent** | Vanderbilt Generative AI for HR (about 4h, one graded assignment, paid certificate); HRCI AI for HR ($399, about 12h, includes compliance, assessment NV). **Trade-off** | AIHR AI for HR Certificate (about 33h, $1,125, capstone, SHRM and HRCI credits; standalone enrolment closed until Oct 27). **Strong on content**, costly | Same AIHR program is closest. **Trade-off**: no bias auditing or adverse-impact testing of hiring AI |
| **Leadership** | AWS Generative AI for Executives (about 1h, free, no certificate). **Gap** | OpenAI Academy Lead AI Adoption path (about 180 min per a search result, NV); Anthropic Deploying Claude Enterprise (free, quiz, product-specific). **Trade-off** | University executive programs exist (NV on official pages; the one reported price is about $24,500). **Gap** for an affordable, graded course |
| **Governance and responsible AI** | Microsoft Explore responsible AI (free, assessment, badge, Azure-framed); Google Cloud Intro to Responsible AI (about 1h, principles only). **Trade-off** | NIST AI RMF and Playbook (a free framework, not a course); IAPP AIGP training (hours and price NV). **Gap** for a hands-on course | IAPP AIGP (general) and ISACA AAIA (needs an existing audit credential; exam $459 members). **Strong** as external credentials, not training |
| **Finance and accounting** | ACCA Certificate in AI for Finance Professionals (GBP 230 to 310, one-hour assessment, certificate and badge; hours NV; page says both 10 modules and 15 units); Microsoft Copilot for Finance (13 units, free, updated 2026-10-19, needs Copilot access). **Trade-off** | Edureka Generative AI for Finance and Accounting (about 29h on Coursera, graded projects, training-company provider); AICPA and CIMA Hands-On Bootcamp (3h live Dec 16, 2026, $295 to $395, no assessment). **Trade-off** | AICPA and CIMA AI Skills Accelerator is press-reported only (no course list found). **Gap** |
| **Legal support** | NALA Practical Generative AI for Paralegals (1.0 CLE hour, $49 to $70, recorded, no assessment listed); Microsoft Copilot for Legal (14 units, free). **Trade-off** | ibl.ai Contract Review with AI (5.5h, updated 2026-08-25, validates an agent against ten reviewed agreements; vendor provider); Coursera AI for Legal Professionals (about 7h, 8 quizzes). **Trade-off** | BABL AI Governance for Legal Professionals (three paid courses at $299, capstone and exam; governance only). **Gap** for benchmarking agents |
| **Sales and customer success** | Microsoft Copilot for Sales (14 units, free); Coursera Generative AI for Sales (Microsoft, about 20h). **Trade-off** | Nebraska-Lincoln with Ziplines AI for Sales (5 weeks, $1,850, five deliverables including two agentic workflows with human checkpoints); HubSpot GTM Bootcamp (free to HubSpot customers only). **Trade-off**: price and access | Salesforce Agentforce Sales trail (about 27h, admin configuration). **Gap**; nothing found for customer success at any level |
| **Marketing and content** | UVA Darden Generative AI in Marketing (Coursera, about 7h, certificate); AMA and LinkedIn Learning certificate (hours, price NV). **Trade-off** | HubSpot Marketing AI Micro-Internship (20h, students only). **Gap** | None verified. **Gap** |
| **Workflow automation and agents (no-code)** | Zapier AI Builder Path (about 105 min, free, certificate, no graded work). **Trade-off** | Microsoft Build an autonomous agent in Copilot Studio (graded, updated 2026-10-21, needs Microsoft 365 licences). **Trade-off** | Microsoft Agent Academy Operative (badge, safety and evaluation touched; needs trial and admin rights; Microsoft shops only). **Trade-off**; nothing vendor-neutral on approvals, test sets and failure logs |
| **Data and analytics with AI** | DataCamp Intermediate SQL with AI (3h, published 2026-03-18, no graded exam); Coursera Copilot in Excel (about 24h, needs Copilot). **Trade-off** | Microsoft Copilot in Power BI (assessment, updated 2026-10-21); Google Gemini for Data Scientists and Analysts (about 2h). **Trade-off**: vendor-locked | IBM Generative AI for Data Analysts (34h, generic, no graded work stated). **Gap** |
| **Coding assistants, developers** | GitHub Skills Getting Started with Copilot (under 1h). **Trade-off** | DeepLearning.AI Claude Code course (2h, graded; free "for a limited time"). **Strong** | Anthropic Claude Code in Action plus subagents and agent-skills courses (the latter two not opened). **Trade-off**: no team coding-agent policy course |
| **Building with AI, non-developers** | None usable: every option assumes an editor, command line, Git or Python. **Gap** | None. **Gap** | None. **Gap** |
| **AI engineering (builders)** | Hugging Face Agents Course (free, quizzes, needs Python). **Trade-off** as an on-ramp | Anthropic Building with the Claude API (free, certificate, covers evals and RAG; Claude-specific). **Strong** | DeepLearning.AI Agentic AI (9h55m, 8 graded assessments, covers evaluation; graded work needs Pro). **Strong** |

Cells to read as settled: Foundations beginner, HR intermediate, developer intermediate, and all three AI engineering levels. Gaps: 15 of the 42 cells (all three non-developer building cells, both office intermediate and advanced, both marketing intermediate and advanced, leadership beginner and advanced, and one each for foundations advanced, governance intermediate, finance advanced, legal advanced, sales advanced and data advanced). Another 21 are trade-offs and 6 are strong.

### 10.3 Links

Foundations: https://anthropic.skilljar.com/ai-fluency-framework-foundations , https://www.deeplearning.ai/courses/ai-prompting-for-everyone/ , https://academy.openai.com/pages/courses , https://anthropic.skilljar.com/claude-101 . Office: https://learn.microsoft.com/en-us/training/paths/ai-fluency/ , https://www.coursera.org/learn/google-ai-essentials , https://www.salesforce.com/agentforce/ai-agent-course/ . HR: https://www.coursera.org/learn/generative-ai-for-hr-professionals , https://shop.hrci.org/hrci-pro-ai-for-hr/ , https://www.aihr.com/courses/artificial-intelligence-for-hr-certification/ . Leadership: https://www.coursera.org/learn/generative-ai-for-executives , https://anthropic.skilljar.com/deploying-claude-enterprise-with-confidence . Governance: https://learn.microsoft.com/en-us/training/modules/responsible-ai/ , https://www.coursera.org/learn/introduction-to-responsible-ai , https://www.nist.gov/itl/ai-risk-management-framework , https://iapp.org/certify/aigp/ , https://www.isaca.org/credentialing/aaia . Finance: https://www.accaglobal.com/learning-and-events/acca-learning/certificate-in-artificial-intelligence-for-finance-professionals.html , https://learn.microsoft.com/en-us/training/modules/empower-workforce-copilot-finance/ , https://www.coursera.org/specializations/generative-ai-for-finance-and-accounting , https://www.aicpa-cima.com/cpe-learning/conference/hands-on-generative-ai-bootcamp-for-cpas-practical-skills-you-can-use-immediately . Legal: https://nala.org/courses/odw2535-practical-generative-ai-for-paralegals-2/ , https://learn.microsoft.com/en-us/training/modules/empower-workforce-microsoft-365-copilot-legal-use-case/ , https://ibl.ai/solutions/legal/course/contract-review-with-ai.md , https://www.coursera.org/learn/ai-for-legal-professionals , https://courses.babl.ai/p/ai-governance-for-legal-professionals-certification-program . Sales: https://learn.microsoft.com/en-us/training/modules/empower-workforce-copilot-sales/ , https://www.coursera.org/specializations/microsoft-copilot-for-sales , https://upskill.unl.edu/ai-for-sales/syllabus , https://www.hubspot.com/academy/bootcamps/home?toggleid=6 , https://trailhead.salesforce.com/content/learn/trails/agentforce-sales-build-the-revenue-engine-for-your-business . Marketing: https://coursera.org/specializations/generative-ai-in-marketing , https://academy.hubspot.com/courses/hubspot-marketing-ai-micro-internship-program-en . Automation: https://learn.zapier.com/path/ai-builder-path , https://learn.microsoft.com/training/modules/autonomous-agent/ , https://microsoft.github.io/agent-academy/operative/standard/ . Data: https://www.datacamp.com/courses/intermediate-sql-with-ai , https://www.coursera.org/learn/advanced-data-analysis-and-visualization-with-copilot-in-excel , https://learn.microsoft.com/en-us/training/modules/power-bi-copilot/ , https://www.skills.google/course_templates/879 , https://www.coursera.org/specializations/generative-ai-for-data-analysts . Coding: https://github.com/skills/getting-started-with-github-copilot , https://www.deeplearning.ai/short-courses/claude-code-a-highly-agentic-coding-assistant/ , https://anthropic.skilljar.com/claude-code-101 . Engineering: https://huggingface.co/learn/agents-course/unit0/introduction , https://anthropic.skilljar.com/claude-with-the-anthropic-api , https://www.deeplearning.ai/courses/agentic-ai/ .

### 10.4 What to build ourselves, in order

Build only where the gap is real, the audience is large on our own data (section 3), and a purpose-built course would clearly beat what exists. Hours are **[Estimate]**, on the 80 to 120 hours per six-hour course baseline in `docs/AI_COURSE_DEVELOPMENT.md`.

| Order | Build | Level | Why it beats what exists | Hours |
|---|---|---|---|---|
| 1 | **Reliable AI at work**, vendor-neutral. Reusable prompt library, a checking routine, and graded tasks with seeded errors | Intermediate, all functions | Gap 10.1(1) and the Foundations intermediate cell. Becomes the shared first module of every other build | 90 to 120 |
| 2 | **AI in finance and accounting**: intermediate and advanced only. Variance and close workflow with an agent, a test set with known answers, an error rate on numbers and citations, reconciliation and audit trail, sign-off levels. Curate ACCA and Microsoft for beginner | Intermediate and advanced | Finance is our largest exposed non-technical pool (section 3) and the advanced cell is empty | 140 to 180 |
| 3 | **Evaluating and approving agents for non-engineers**: a no-code agent on an operations case, a 20-case test set, an error log, a human approval step, a go or no-go memo | Advanced, cross-function | Gap in automation, foundations, finance and customer success; every existing advanced course is for engineers or one vendor | 90 to 130 |
| 4 | **Leading teams through AI**, graded and vendor-neutral: a use-case choice, success measures, ownership, a team policy, a 90-day plan | Intermediate | The market offers a one-hour overview or a roughly $24,500 executive program | 100 to 140 |
| 5 | **AI governance in practice**: classify a use case, map it to NIST functions, draft an acceptable-use policy and a risk register, a mini impact assessment | Intermediate | NIST and the certifications exist but no practice course was found | 80 to 110 |
| 6 | **Build a small tool with AI, for non-developers** | Beginner to intermediate | Nothing usable exists; a spreadsheet problem to a working tool, with a plain-language review checklist and a list of what not to build | 90 to 120 |
| 7 (on a signed scope) | **AI in legal support**, advanced: a citation-verification lab with seeded fake cases, privilege handling, an agent benchmark | Advanced | Paralegals are the largest uncovered exposed group on our board (section 3) | 90 to 120 |
| 7 (on a signed scope) | **Office, administrative and customer-support** intermediate and advanced: real ticket and email scenarios, a check-before-send routine, a triage agent | Intermediate and advanced | Verified gap; the audience is large in Anthropic's data and thin on our board | 80 to 110 |

Total for the eight: about 760 to 1,030 hours. This replaces the earlier plan of building all twelve courses (930 to 1,300 hours): the function-by-function beginner courses are curated instead. Sales, marketing, HR and data keep their curated ladders until a buyer pays for more.

**Curate and recheck.** Each curated link gets a quarterly recheck for date, price, access and whether the course still exists. The researchers could not open OpenAI Academy course pages (403), which means the intermediate foundations and leadership picks rest on a track description and a search result.

