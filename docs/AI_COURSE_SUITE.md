# AI course suite

Written 2026-10-20. Design only: no course content is built. This extends `docs/AI_COURSE_DEVELOPMENT.md` (who pays, the three models, the decisions already made) with the shape of the whole catalog we could author, which courses to build first, and what each costs to build. The public side is https://launchyournextchapter.com/ai-training (offer) and https://launchyournextchapter.com/ai-skills (proof).

**How to read the numbers.** Every figure is tagged. **[Data]** comes from the postings: the nightly snapshot in the production table `AiMarketSnapshot` (row computed 2026-10-20 23:45 UTC, read-only SQL) or the static 2026-10-16 table in `src/lib/skills/ai-skill-market.data.ts`. **[Report]** comes from the White Collar Employment Report AI chapters, with the source the report names. **[Judgment]** is my call and has no data behind it. **[Estimate]** is a build-hours or price guess. A posting that asks for an AI skill is demand for the skill; it is not evidence that a course raises pay or hires anyone, and nothing here says AI caused a layoff.

## 1. Decisions this document takes as given

- First build is the Applied track, "AI in your function". Leadership is second. No public price. At most two paid builds at once (`docs/AI_COURSE_DEVELOPMENT.md`, Decisions).
- We are not an accredited provider and do not claim WIOA eligibility. We build for colleges, boards and employers, who own and run the course.
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
4. Operations has the lowest share among the large functions (6.4%) yet the largest like-for-like gap ($39k), and has 20,601 postings, the biggest non-engineering pool. Share asking is low, so the signal is early, not absent **[Judgment on how to read it]**.

**By level [Data].** The snapshot keeps level only inside paid-posting premium cells, so it cannot size entry-level demand. Paid postings with a stated level: senior 4,953 (53% ask for AI), manager 3,479 (38%), director 2,828 (38%), mid 2,244 (39%), early 1,652 (30%), VP 327 (46%), entry 177 (19%, only 34 ask). Only 177 paid entry-level postings exist in these cells, so I do not read an entry-level demand number from them. The share is of paid postings, which is not the share of all postings.

**New-worker context [Report].** Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers (Stanford Digital Economy Lab, Aug 2026); firms using AI grew senior roles 32% and junior roles 6% against non-adopters (Revelio, Aug 2026); senior postings rose 14.7% and entry-level fell 7.5% over the year to May 2026 (Indeed Hiring Lab). Within a job, AI helps the least experienced most: customer-support agents gained 34% against 14% on average (Brynjolfsson, Li, Raymond, QJE 2025). The report's own reading: the measurable effect is at the entry gate, through hiring, and is consistent with but does not prove AI as the cause.

**Retraining context [Report].** The federal Dislocated Worker program served about 187,000 people in its latest year and about one in five received training. Among unemployed white-collar workers aged 55–64, 39% have searched 27 weeks or more. 30% of adults 50+ use AI (AARP, Dec 2025). Public retraining is small next to the number of long searches.

**By industry [Data, partial].** The snapshot has no industry breakdown (its `dimensions` block is absent), so industry shares asking are not available. The static table gives posting volume per function x industry cell (1,000+ postings only), which shows where an industry lens would reach the most postings: financial services (investment 3,786, engineering 3,736, finance 3,176, sales 1,431, operations 1,132), healthcare (clinical 4,548, engineering 2,424, operations 1,830, people 1,007), industrial (engineering 9,352, operations 2,862, sales 1,988, finance 1,530), technology (engineering 15,606, data 4,991, sales 3,720), life sciences (engineering 2,030, clinical 1,130, operations 1,095). Government appears only once (engineering, 1,091), which is a crawl-coverage gap more than evidence of low demand **[Judgment]**.

**What the existing catalog already covers [Data].** Of the 24 skills, third-party courses are densest on tool use (9 courses), prompt design (8) and assistants (7), and thinnest on AI-enabled analytics (1), AI product management (1), RAG (1), GPU (1), adoption and change (2), automation platforms (2), AI in business apps (2), creative tools (2), coding assistants (2) and leading AI teams (0). The free catalog does not need a rival on basic tool use. The gaps we can fill are function-specific practice with a work sample, adoption and change for managers, automation for non-engineers, and analytics.

## 3. Taxonomy of a comprehensive suite

A course is a cell in five axes. We do not build the cross-product: a course is a **core** plus a **function pack** plus an optional **industry lens**, so one build serves many cells.

### Axis A: function (what the learner does all day)

Applied function courses, each the same spine (section 5): Finance and accounting; Operations and program management; Sales and customer success; Marketing and content; Human resources; Legal and compliance (later, tool set differs: Harvey/CoCounsel class); Product; Design; Clinical and healthcare administration (later, low posting share today at 2.3%). Builder functions (Data & Analytics, Engineering, Security, Research) are served by the third-party catalog and by learners moving into them, not by our first builds **[Judgment]**.

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

## 4. Coverage matrix

Rows are the proposed courses (section 5). Columns: the posting signal behind the course, and the learner types it fits. "Demand" is rated from the data in section 2 where a number exists; the rating itself is **[Judgment]**.

| # | Course | Postings behind it [Data] | Demand | Displaced | New worker | Changer | Employee |
|---|---|---|---|:-:|:-:|:-:|:-:|
| 1 | AI foundations for working professionals | Tool use is the top ask in 18 of 21 functions | Strongest | ● | ● | ● | ● |
| 2 | AI-ready launch (new workers) | 177 paid entry postings, 34 ask; [Report] entry-gate evidence | Strong on [Report], thin on [Data] | | ● | | |
| 3 | AI in finance and accounting | 15,431 postings, 1,860 ask (12.1%) | Strong | ● | | ● | ● |
| 4 | AI in operations and programs | 20,601 + 5,291 postings, 1,311 + 348 ask; largest like-for-like gap ($39k) | Strong, early | ● | | ● | ● |
| 5 | AI in sales and customer success | 15,579 + 3,092 postings, 1,477 + 415 ask | Medium-strong | ● | | ● | ● |
| 6 | AI in marketing and content | 7,599 postings, 1,494 ask (19.7%) | Strong | ● | | ● | ● |
| 7 | AI in HR and talent | 7,993 postings, 778 ask (9.7%) | Medium | ● | | ● | ● |
| 8 | Automation and agents for non-engineers | `a_agentic_automation` is top 2 or 3 in nearly every function | Strongest cross-cutting | ● | | ● | ● |
| 9 | Analytics with AI | `a_ai_analytics` in top 8 of Ops, Sales, Marketing, Strategy, Customer Success; 1 third-party course | Medium, a catalog gap | ● | ● | ● | ● |
| 10 | Leading teams through AI | `l_transformation` and `l_strategy` in Finance, Ops, Sales, HR, Strategy; director and manager postings 2,828 and 3,479 with pay | Strong at senior levels | ● | | | ● |
| 11 | AI governance and responsible use | `l_governance` top 5 in Finance, Sales, Security, Legal, HR, Programs, Strategy | Medium-strong | ● | | ● | ● |

Not in the first eleven, by design: Builder courses (the free catalog covers them and they sell to a different buyer); legal, clinical, design and product function packs (add after the template proves out); an executive-only course (served as a short format of course 10, below).

## 5. Proposed initial courses

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

## 6. Recommended sequence and build effort

**Estimates, not quotes.** Baseline is the 80 to 120 hours per six-hour self-paced course in `docs/AI_COURSE_DEVELOPMENT.md`. Hours cover design, content, assessment items, work-sample rubric, a pilot read-through and revisions, not sales time. The first function course carries the shared template and the Foundations core; later function courses are cheaper because they reuse both.

| Wave | Course | Estimated build hours | Why here |
|---|---|---:|---|
| 1 | 3. AI in finance and accounting, **plus the shared template and Course 1 core** | 140 to 180 | Finance is the largest non-technical function with AI asks (1,860 postings) and a tool set (Copilot, spreadsheets) that is stable. Building it forces the template, assessment engine and Course 1 content into existence once. Course 1 then ships with little extra work |
| 1 | 1. AI foundations, packaged standalone | +10 to 20 | Mostly extracted from Wave 1 |
| 2 | 10. Leading teams through AI | 100 to 140 | Decided second build; sells to college executive education; cohort format needs a facilitator guide |
| 3 | 4. Operations and programs | 70 to 100 | Biggest pool of postings and largest like-for-like gap; reuses template |
| 3 | 8. Automation and agents for non-engineers | 90 to 120 | Top-2 or 3 ask in nearly every function; sells alongside every function course. Highest tool churn |
| 4 | 6. Marketing and content | 60 to 90 | Template reuse; strong share (19.7%) |
| 4 | 5. Sales and customer success | 60 to 90 | Template reuse |
| 5 | 11. AI governance and responsible use | 80 to 110 | Cross-cutting ask; needs counsel review |
| 5 | 2. AI-ready launch (new workers) | 90 to 130 | Needs a college partner to shape; peer review adds design time |
| 5 | 9. Analytics with AI | 90 to 120 | Needs clean practice datasets |
| 6 | 7. AI in HR and talent | 70 to 100, plus counsel review | Compliance content must be reviewed first |

Total for all eleven: about 960 to 1,350 hours **[Estimate]**. Waves 1 and 2 together: about 250 to 340 hours.

**Ordering rules.**

- **A signed scope beats the order.** The sequence is the default. If a college or board signs for a different course, that course jumps the queue, subject to two paid builds at once.
- **Waves 1 and 2 are the two concurrent paid-build slots.** Do not start Wave 3 while either is unshipped.
- **No build starts without a signed scope**, per `docs/AI_COURSE_DEVELOPMENT.md` (First 30 days, step 4). A build-first exception for Course 1 costs about 40 to 60 hours **[Estimate]** and makes sense only if the first quote stalls on "show me a sample"; that is a decision for the owner.

## 7. Which buyer for which course

| Buyer | Courses to lead with | What the first conversation offers |
|---|---|---|
| College (continuing education, alumni, executive education) | 10, 3, 1, 9 | The alumni AI-gap measurement first, then a quote. Executive education buys 10. Career services buys 2 |
| Workforce board / American Job Center | 1, 3, 4, 8, 2 | A grant-partner role in a specific notice when one opens; otherwise contracted training for dislocated workers. No speculative grant chasing |
| Employer | 10, 11, 4, 8 and its own function | Per-participant cohort license; AI skills inside a transition package for layoff employers |

On the leading job transition platform the member profile records each work sample as evidence, so a buyer sees completion and finished work, not attendance alone.

## 8. Open questions and risks

1. **Accreditation and WIOA eligibility.** We are not accredited. WIOA individual training accounts need a state eligible training provider list entry, which a college partner can hold. Workforce Pell goes to accredited institutions and, as I understand it, to programs of 150 to 599 clock hours, which none of these 4 to 12 hour courses meets alone **[Judgment; confirm before any proposal says so]**. Question for counsel and a partner college: can a bundle of several courses, with an accredited college as the provider of record, qualify?
2. **Outcome claims.** Postings asking for a skill is demand. Do not state that a course raises pay, hires faster or protects a job. Proposals may cite the posting counts and the premium as a description of postings, with the controls named. This applies to Course 2 hardest, where the evidence is about hiring at the entry gate.
3. **Entry-level demand cannot be sized from our data.** 177 paid entry postings is too few. Before pricing Course 2, decide whether a level breakdown over all postings, not just paid ones, is worth adding to the snapshot.
4. **No industry breakdown in the snapshot.** The snapshot's `dimensions` block is absent, so industry lens priority rests on posting volume, not on share asking. A one-query change to the nightly job would add it.
5. **Tool churn.** Named tools change within months. Keep tool screens in replaceable lab modules, review each course every quarter, and give each course an owner and a review date. Course 8 carries the most risk.
6. **Cost per learner.** Required path costs nothing per learner (rule-based checks). Practice tasks use the learner's own assistant account; a free tier that disappears becomes a learner or buyer cost. The optional AI review is about $0.006 per review under a $50 monthly cap; at 1,000 learners reviewing three samples each that is about $18, inside the cap **[Estimate from the measured per-review cost]**. Any new feature that calls a model per learner needs its cost line first.
7. **Automated-decision rules.** Course 7 touches NYC Local Law 144 and similar rules, and the AI review is member-only until counsel has looked at them (`docs/AI_SKILLS.md`). Same counsel pass for both.
8. **Ownership of the course.** Under course development the buyer owns and runs the course. Decide in advance whether we keep the right to reuse the shared template and Course 1 core across buyers. Without it, Waves 3 to 5 cost much more.
9. **Capacity.** At 100 to 180 hours per build, two concurrent builds is roughly 6 to 10 working weeks of one person for Waves 1 and 2. Any additional hour sold must fit that.
10. **Placeholder prices.** Nothing here sets a price. The $15,000 to $40,000 development range and $150 to $400 per participant range in `docs/AI_COURSE_DEVELOPMENT.md` are still unverified placeholders.
