# Scope: AI for finance and accounting professionals (Wave 1)

Written 2026-10-22. This is the scope for the first build in `docs/AI_COURSE_SUITE.md` (Wave 1): the shared course template, the foundations core, and the finance pack. It is a scope, not a quote, and nothing here is built. Per `docs/AI_COURSE_DEVELOPMENT.md`, no build starts without a signed scope from a buyer; this document is what we put in front of that buyer. Hour figures are estimates.

**Numbers.** From the nightly AI market snapshot (production table `AiMarketSnapshot`, row computed 2026-10-22 23:45 UTC, read-only SQL). They move with the crawl; the course generates its demand page from the data so it does not go stale.

- Finance postings with full text: 18,777. Asking for a specific AI skill: 2,159 (11.5%).
- Skills asked most in finance postings, by count: AI tools in daily work (1,475), AI workflow automation and agents (371), AI assistants (290), LLM engineering (190), AI-led transformation (168), AI strategy (165), AI governance (156), automation platforms (137).
- Tools named most in finance postings asking for AI: Claude (184), Microsoft Copilot (171), ChatGPT (139), Databricks (117), Gemini (36), Power Automate (29).
- Posted pay of finance postings asking for an AI skill: median $170,000 against $117,500 for those that do not (+44.5% raw). Comparing within the same level and industry: +14.7% (about $20,000), from 170 postings in 2 cells. This describes advertised postings. It is not evidence that a course raises anyone's pay.

## 1. What this builds

One learning path, two separately sellable courses:

| Part | Length | What it is |
|---|---:|---|
| Foundations core (Course 1) | 4 h | Four modules every function course starts with. Extracted from the finance build, not built twice |
| Finance pack (Course 3) | 6 h | Five modules plus a capstone, using finance data and finance review habits |
| Shared template | n/a | The spine, assessment format, work-sample rubric and dataset conventions every later function course reuses |

Finished path: about 10 hours of learner time, deliverable as a self-paced course or a 3-week cohort with one live review session per week.

## 2. Learner and prerequisites

- **Who:** accountants, FP&A analysts, controllers, finance managers, and finance staff in transition. Three of the four learner types in the suite apply: laid-off professional, career changer into finance, current employee.
- **Prerequisite:** working knowledge of financial statements and a spreadsheet. No prior AI use assumed.
- **Not for:** people who need to build models or code. That is the Builder track and the free catalog covers it.

## 3. Outcomes (what a learner can do, observable)

By the end a learner can:

1. Use a general assistant to draft and analyze finance work, and write a reusable prompt that states the task, the data, the format and what to leave out.
2. Find the errors in an AI draft: wrong numbers, invented line items, wrong period, a rule misapplied. They do it against a set of known errors.
3. State what may and may not be pasted into a tool, for client, employee and non-public company data.
4. Produce a variance commentary, a reconciliation exceptions list and a month-end narrative, each with a verification log showing what was checked and against what.
5. Build one repeatable workflow (a prompt set or a Power Automate or spreadsheet automation) with a before-and-after time measure and a named human check.
6. Explain their approach to a reviewer in plain terms, including where they would not use AI.

## 4. Module outline

### Foundations core (4 h)

| # | Module | Time | Activities | Check |
|---|---|---:|---|---|
| C1 | Use an assistant for real work | 60 min | Pick the tool the learner's employer allows or a free one; three guided finance tasks (summarize a policy, draft a variance email, explain a ratio) | Complete the three tasks; short rule-based quiz |
| C2 | Prompts that hold up | 60 min | Build a reusable prompt with context, data, format, and constraints; compare four versions on the same input | Rubric: prompt names task, data, format, limits |
| C3 | Check what AI gives you | 60 min | Find errors in four AI drafts built from the practice company's data | Scored on seeded errors found (section 7) |
| C4 | Data handling and confidentiality | 30 min | Sort 12 example data items into allowed and not allowed; read a sample acceptable-use policy | Scenario quiz, rule-based |
| C5 | Core work sample | 30 min | Before-and-after of one real task: the prompt, the output, the checks | Work-sample rubric (section 8) |

### Finance pack (6 h)

| # | Module | Time | Activities | Check |
|---|---|---:|---|---|
| F1 | Variance commentary | 60 min | Budget-versus-actual for the practice company; draft commentary with an assistant; verify every figure to the source | Seeded errors found |
| F2 | Reconciliations and exceptions | 60 min | Bank and subledger reconciliation with planted differences; AI proposes matches and exceptions; learner confirms | Exceptions list matches the answer key |
| F3 | Month-end and flux narrative | 60 min | Draft the month-end narrative from the trial balance movement; separate what is fact from what is inference | Narrative rubric: figures tie, causes marked as hypotheses |
| F4 | Spreadsheet and Copilot workflows | 60 min | Formulas and summaries with Copilot in Excel or an equivalent; how to audit a generated formula | Formula audit exercise with planted faults |
| F5 | Controls, review and governance | 60 min | Build a review log; which finance uses need sign-off; mapping to a company AI policy; the NIST AI Risk Management Framework at a practitioner level | Scenario quiz plus a review-log rubric |
| F6 | Capstone | 60 min | One automation with a before-and-after and a named human check | Finance work sample (section 8) |

Governance is its own module because it is in the top asks for finance postings (156). Automation and agents (371) is the capstone, taught at the level of a no-code workflow, not building agents.

## 5. Practice data (must be built)

Synthetic only: no real company, client or employee data anywhere.

- One fictional mid-size company, 24 months: chart of accounts, trial balances, budget, bank statements, a subledger, vendor list. Realistic enough that ratios behave.
- An **error bank**: for each exercise, a list of planted errors (wrong period, transposed figure, double-counted item, plausible but invented explanation) with severity, so scoring is deterministic.
- An **answer key** for every exercise, and a second dataset variant so repeat cohorts cannot copy answers.
- Estimated 20 to 30 hours, the biggest hidden cost; reused by every finance-adjacent course.

## 6. Delivery format

Source is portable: text modules, datasets, quiz definitions as data, a facilitator guide for the cohort format, and a learner workbook. Hosting options, to decide with the first buyer:

1. **On the platform** (the Learning page renders the course, completion and work samples land in the member's evidence). No cost to the buyer's IT. Needs the course player (section 15).
2. **In the buyer's LMS.** Needs an export (for example SCORM or plain files). Not built in Wave 1 unless the buyer requires it; scope it as a change.

The buyer owns and runs the course. Reuse of the template and the foundations core across buyers is a contract term to settle before signing (suite, risk 8).

## 7. Assessment

- **Rule-based, so no per-learner cost.** Scenario checks and seeded-error scoring run in code against the answer key.
- **Seeded-error scoring:** a learner finds the planted errors in an AI draft. Pass is 8 of 10 planted errors in an exercise, and no more than 2 false alarms. Both numbers are starting values to calibrate in the pilot.
- **Rubric items** (prompt quality, verification log, narrative quality) are checklists a person or the code can score: each item is present or absent, with the criterion written out.
- **Optional AI review of the work sample** exists on the platform (about $0.006 per review, $50 monthly cap across all members), is opt-in and is not part of any required path.
- **Retakes:** unlimited on quizzes; seeded-error exercises serve the second dataset variant.

## 8. Work samples and evidence

Both samples use types that already exist on the platform (`src/lib/evidence/ai-work-samples.ts`), so completion shows up as evidence on the learner's profile.

- **Core sample:** "AI automation with a before and after" in its small form: the task, the tool used, the prompt, the output check.
- **Finance capstone:** the same type with a measured before and after, the tool named, the flow shown and a human-review step. Its four checks (tool named, measured before and after, human review, flow shown) are the capstone's pass criteria.
- For governance-heavy cohorts, F5's review log can be submitted as the "AI policy or use-case portfolio" type.

## 9. Build plan and hours (estimates)

| Work | Hours |
|---|---:|
| Design: outcomes, spine, assessment format, work-sample rubric, facilitator guide outline | 20 |
| Foundations core content (C1 to C5) | 30 to 40 |
| Finance pack content (F1 to F6) | 50 to 60 |
| Practice data, error bank, answer keys, variants | 20 to 30 |
| Assessment items and scoring rules | 15 to 20 |
| Pilot, revisions, facilitator guide, packaging | 15 to 20 |
| **Total** | **150 to 190** |

This sits at the top of the suite's 140 to 180 hour estimate because the practice data and facilitator guide are included here. At one person's pace, that is roughly 4 to 5 working weeks.

**Not in those hours: the course player.** The platform has no way to host a course today. The Learning page lists courses and links out to other providers (`Course`, `OrgCourse` and their progress tables hold a link and a status, nothing inside the course). Hosting this on the platform needs the player in section 15, about 80 to 100 more hours of engineering. Content and engineering can run in parallel. If the first buyer wants the course in their own system instead, the player is not needed for that buyer.

## 10. Pilot

- 8 to 12 learners from our members in finance roles, who consent, using the self-paced format.
- Measure completion, errors found per exercise, time per module, and where learners stop or get the answer wrong.
- Revise modules where more than a third of learners miss the same item.
- No claim about jobs, pay or hiring comes out of the pilot. It tests whether the course works as a course.

## 11. Definition of done

- Every module has outcomes, time, activities, a check, and an answer key where it has a check.
- A learner with a free assistant account can finish the path with no paid tool.
- All data is synthetic; confidentiality module reviewed for accuracy.
- A pilot read-through by someone in finance who did not write it, with their fixes made.
- Each course has an owner and a review date, 90 days out, because the named tools change.

## 12. Risks specific to this course

- **Tool churn.** Claude, Microsoft Copilot and ChatGPT lead the postings but their screens change. Tool steps live in replaceable lab pages; the skills do not depend on one product.
- **Continuing professional education credit.** Accountants often need approved CPE hours. We do not claim any. A sponsor arrangement would come through a college or professional body; confirm before a buyer asks.
- **Professional-judgment boundary.** The course teaches checking and documentation, not replacing professional review. State that in module F5 and the facilitator guide.
- **Practice data realism.** If the synthetic company is unrealistic, learners dismiss the exercises. Have a working finance professional review the data.
- **Outcome claims.** Postings data describes demand. Do not put pay, hiring or protection claims in marketing for this course.

## 13. Questions to settle with the first buyer before signing

1. Which tool does your finance team actually use (Copilot, an enterprise Claude or ChatGPT, none)?
2. Self-paced, cohort, or both? Who facilitates live sessions?
3. Hosted on our platform or exported to your LMS?
4. Who owns the course, and may we reuse the shared core and template for others?
5. Do your learners need CPE or continuing-ed credit, and from whom?
6. How many learners, over what period, and what completion data do you need reported?
7. What funding line pays for this, and what does it require us to document?

## 14. Decisions needed

- Whether to build the foundations core first on spec (about 40 to 60 hours) so there is a sample to show. The suite recommends not doing this unless the first quote stalls on "show me a sample".
- Which buyer to scope against first: a college's executive education or alumni arm (best fit), or an employer finance team.

## 15. How it gets built

### Principles

- **Content is data in the repo.** Each module is a Markdown file; each exercise, quiz and rubric is a JSON file next to it. Everything is reviewed in a pull request like code, versioned, and exportable to a buyer's system later.
- **Exercises are scored by code, never by a model.** A learner marks errors in a fixed AI draft; the code compares the marks with the answer key. A pasted result is checked by extracting its figures and tying them to the practice data. A fixed draft or key costs nothing per learner and gives the same result every time.
- **AI drafts in the exercises are written once and frozen.** The "AI drafts with planted errors" are produced ahead of time with an assistant, then edited so the errors are exactly the ones in the answer key. No model call happens while a learner works.
- **Practice data comes from a generator, not by hand.** A seeded script builds the fictional company's ledgers and plants each error with a record of where it is, so the answer key and the data cannot disagree. A second seed gives the second variant.
- **A working finance professional signs off.** I can draft modules, exercises and rubrics. Someone who has closed a month signs off each finance exercise before the pilot; that person is not me.

### The course player (engineering)

Pages under the Learning area: a course home, a module view, a quiz and a seeded-error exercise component, a progress bar and a completion screen. Because these are candidate pages, they follow `docs/candidate-redesign.md`: build each screen in `src/app/dev-preview/` and look at it before wiring data. Parts, with estimated hours:

| Part | What | Hours |
|---|---|---:|
| Data | Tables for a course run, module progress and exercise attempts; SQL file in `prisma/manual/`; applied before the code that reads it | 8 |
| Content loader | Reads the Markdown and JSON for a course, validates them against a schema, fails the build on a broken exercise | 8 |
| Screens | Course home, module reader, quiz, seeded-error exercise, completion; mobile and desktop | 24 to 32 |
| Scoring | Seeded-error scoring, figure tie-out against the practice data, rubric checklists, retakes with the second variant | 12 to 16 |
| Evidence handoff | Completion creates the member's work sample in the existing "AI automation with a before and after" type, pre-filled from the capstone | 6 to 8 |
| Buyer reporting | Counts-only completion and error rates per team, minimum 10 people, on the employer Learning page and the college Outcomes tab | 8 to 10 |
| Analytics | PostHog events for course started, module completed, exercise submitted, capstone submitted | 3 |
| Tests | Loader, scoring and screen tests | 10 |
| **Total** | | **80 to 100** |

### Order of work

1. **Week 1, foundations that everything depends on.** Design the spine and schemas. Build the practice-data generator and the error bank for module F1 first, because every later module reuses them. Write one module (C3, "Check what AI gives you") end to end as a Markdown file and an exercise JSON.
2. **Week 1 to 2, the player skeleton.** The loader, the module reader and the seeded-error exercise, running on that one module in `src/app/dev-preview/`. This is the vertical slice: one module, real data, real scoring.
3. **Week 2, the slice is read by a finance professional.** Fix what they find before writing the rest. Cheaper than fixing eleven modules.
4. **Weeks 2 to 4, the remaining modules.** Foundations C1 to C5, then F1 to F6 in order, each with its exercise, answer key and rubric.
5. **Week 4, evidence handoff and buyer reporting.**
6. **Week 5, pilot** with 8 to 12 consenting members in finance roles, then revisions.

Roughly 6 to 8 working weeks if one person does both content and player. Two people (one on content, one on the player) is closer to 4 weeks.

### What I would do first

Build the practice-data generator and module C3's exercise as the first pull request. It forces the three decisions that shape the rest (file format, scoring rule, how errors are planted), and it gives the finance reviewer something real to read within days.

## 16. What makes it a grade-A course

The scope above defines what the course covers. This section defines how good it has to be, so the build is judged against a bar and not against taste. It adds about 130 to 190 hours (section 16.7).

### 16.1 Teaching design

- **Start from what the learner can do, then work backward.** Each outcome in section 3 gets an assessment first, then the activity that prepares for it. A module with no assessed outcome is cut.
- **Show, then fade.** Every skill follows the same arc: a worked example with the reasoning narrated, a guided attempt with hints, then an independent attempt with none. The hints are removed on purpose.
- **Practice retrieving, not rereading.** Each module opens with two or three questions from earlier modules, and the capstone draws on all of them. Spacing and mixing earlier skills into later exercises beats repeating the same one.
- **Teach the skill that matters most: checking.** The scarce finance skill is catching a plausible wrong answer. So error detection is practiced in every module on a rising difficulty ladder: obvious (wrong period), subtle (a transposed figure), plausible (an invented cause that sounds right).
- **Real work, not trivia.** Every exercise is a task a finance professional does: a variance note, a reconciliation, a month-end narrative. Quizzes check understanding of decisions, not definitions.
- **Short units.** A screen asks for one thing. Modules run 30 to 60 minutes with a visible stopping point every 10 to 15.
- **Say what AI is bad at, with evidence.** Learners see failures in context (an invented line item, a figure that does not tie), and learn the habit that catches each.

### 16.2 Visual design

- **One design system for the whole course**, built from the platform's own tokens, in light and dark. Two typefaces at most. Consistent colors for source data, AI output and learner input, so the learner always knows which they are reading.
- **Diagrams over paragraphs** wherever a relationship is the point: the verify-before-trust loop, a variance bridge, a reconciliation flow, where data goes when pasted into a tool. Drawn in SVG, accessible, editable.
- **No walls of text.** A rule of thumb: no screen has more than about 120 words without an interactive element, an image or a figure.
- **Screenshots are the weak point** because tool screens change. Use annotated diagrams of the idea, and keep real tool screenshots in a small replaceable set with a review date.
- **Short screencasts, optional.** Two to four minutes each, captioned, with transcripts, only where watching beats reading (the sequence of clicks in Copilot in Excel). Everything a video teaches is also in text.
- **Accessible by default:** WCAG 2.2 AA, full keyboard use, captions and transcripts, no color-only meaning, works at phone width.

### 16.3 Interactives to build

Each one practices a skill the course assesses. They are components built once and reused by every later function course.

| Interactive | What the learner does | Skill |
|---|---|---|
| Error hunt | Reads an AI-drafted commentary and marks the sentences that are wrong; sees an explanation for each miss and each false alarm | Checking AI output |
| Tie-out | Clicks a number in the draft and the matching source cell highlights in the ledger, or nothing does | Verifying figures |
| Prompt lab | Compares four frozen outputs from four prompts on the same input, then rewrites a weak prompt against a checklist | Prompts that hold up |
| Paste or not | Sorts 12 data items into allowed and not allowed, with the rule shown after each | Confidentiality |
| Variance bridge | Drags drivers into a waterfall until the bridge ties to the total, then writes the line that explains it | Variance commentary |
| Reconciliation matcher | Accepts or rejects AI-proposed matches with a confidence shown; unmatched items remain | Reconciliation |
| Formula audit | Opens a spreadsheet grid where one generated formula is wrong, finds it and fixes it | Spreadsheet workflows |
| Review log builder | Fills a review log row for each use and assigns the sign-off | Controls and governance |
| Automation canvas | Lays out a workflow from trigger to output with the human check placed on it; flags a missing one | Capstone |

### 16.4 Assessment

- **Pre-test, post-test.** A short diagnostic before module C1 and the same skills after F6, so we can show learner gain on the same items, and show a buyer what a cohort gained.
- **Criterion-referenced.** Every score maps to a written outcome, and the learner sees which outcome they missed and why.
- **Error detection is scored properly:** found, missed and false alarms, not just a total. A learner who flags everything does not pass.
- **Calibration.** On exercises, the learner rates their confidence before the answer is shown. Learners who are confident and wrong get a pointed explanation. The calibration gap is the most useful number we can give a buyer.
- **A capstone with a rubric of observable items**, each present or absent with the criterion written out (section 8). In a cohort, a peer or facilitator also reviews it against the same rubric.
- **An item bank, not a fixed test.** Two or three variants per item, drawn at random, so a retake is a different test.
- **Mastery gating where it matters:** F5 (controls) must be passed before the capstone unlocks.
- **No trick questions.** Every item is answerable from what the course taught, with one defensible answer.

### 16.5 Content quality

- **Written by someone who has done the job, or reviewed line by line by someone who has.** A finance professional signs off every exercise and the practice data (section 15).
- **Plain language and a stated reading level.** Short sentences, no jargon without a definition, terms defined once and used the same way after.
- **Every factual claim has a source or is marked as judgment**, including any figure about postings. Nothing in the course claims a course raises pay or protects a job.
- **A review date on every module,** 90 days out, and an owner. Tool-specific pages are the first to expire.

### 16.6 The quality gates

A module does not ship until it passes these. Numbers are starting values to calibrate in the pilot.

| Gate | Check | Bar |
|---|---|---|
| Alignment | Each outcome has an assessment and an activity | 100% |
| SME review | A finance professional has read and signed off the exercises and data | Every module |
| Accessibility | Automated checks plus a keyboard and screen-reader pass | WCAG 2.2 AA, no blockers |
| Time on task | Median learner time in the pilot against stated time | Within 25% |
| Completion | Pilot learners who finish the course | At least 70% |
| Learning gain | Post-test minus pre-test on the same items | Positive for at least 80% of learners |
| Item quality | Each item's difficulty and how well it separates strong from weak learners | Revise any item answered right by under 20% or over 95% |
| Confusion | Learners who miss the same item | Revise any item missed by over a third |
| Mobile | Every interactive works at phone width | Pass |

### 16.7 What this adds

Estimates, on top of the 150 to 190 content hours and the 80 to 100 player hours in sections 9 and 15.

| Work | Hours |
|---|---:|
| Instructional design: outcome map, worked examples, hint ladders, item bank | 30 to 40 |
| Visual design: course design system, diagrams, layout of each screen | 25 to 35 |
| Interactives: the nine components above, with scoring | 55 to 80 |
| Accessibility, quality gates and item analysis | 20 to 30 |
| Optional screencasts and captions, 6 to 8 short videos | 30 to 50 |
| **Total with videos** | **160 to 235** |
| **Total without videos** | **130 to 185** |

All in, with content, player and the A-grade standard, the first course is roughly **360 to 475 hours** (about 8 to 12 weeks for one person, or about 5 to 7 with two). The shared template, player and interactives are reused, so the second function course costs closer to the 60 to 100 hours in the suite.

### 16.8 What I would not do

- Build every interactive before testing one. The error hunt and the tie-out come first because they carry the main skill; if learners get better at checking from those alone, the rest can be simpler.
- Film long lectures. Retention is better from short worked examples and doing the task.
- Promise outcomes. The pre-test and post-test show what learners gained. They do not show a job or a raise.

## 17. What other courses do (research, 2026-10-22)

Six reviews of public pages: general-audience courses (Google, DeepLearning.AI, Wharton, Vanderbilt), vendor academies (Anthropic, Microsoft Learn, Trailhead, GitHub Skills, OpenAI, Google Skills, Runway), technical short courses and specializations, 11 finance and accounting courses, college and governance programs, and the learning-science literature. Pages were read through a summarizing fetch tool, so exact figures are "as reported". Anything behind a login (quiz content, autograders, retake rules) was not seen and is not claimed. Check any number before it goes into customer-facing copy.

### 17.1 What the good ones share

1. **Short units with the time shown.** Clips of 2 to 10 minutes, units of 5 to 50 minutes (DeepLearning.AI, Andrew Ng's courses, Trailhead). One study of 6.9 million edX video sessions found shorter and more informal videos hold attention best (Guo, Kim and Rubin, 2014); it measures watch time, not learning, and the "about 6 minutes" figure is secondhand.
2. **Practice is first-class.** Trailhead weights its hands-on projects at 3,000 of 9,300 points. DeepLearning.AI alternates a short video with a code lab. Microsoft Learn marks its exercise optional and needs the learner's own licensed account, which is the pattern to avoid.
3. **The learner's own work is checked and the reply is specific.** GitHub Skills makes the learner's repository the course: a bot detects the result and replies with the next step, or with exactly what to check. The finance version is a named artifact whose totals and flagged items are checked by code.
4. **A named framework carries the course.** Anthropic's AI Fluency course is built on four named steps (Delegation, Description, Discernment, Diligence). A finance course needs its own short, memorable loop.
5. **A way to skip.** Google Skills lets a confident learner jump to the challenge lab with progress kept. The evidence on experienced learners says extra guidance can hurt them (expertise reversal), so a pre-test and a skip path are part of the design.
6. **A portable artifact.** Google Prompting Essentials ends with a reusable prompt library. Every course reviewed proves completion only; none gives a buyer dated, inspectable work.
7. **Hours, pass rules and outcomes are not published** in most of them. Buyers (colleges, boards, employers) have to guess. CFI is the exception: it states an 80% pass mark and retakes.
8. **A free front door and stackable units.** Purdue and IU Kelley use a free course to bring people in. Purdue sells 16 courses of about 15 hours each as stackable units.
9. **Support for cohorts.** CMU's executive program adds facilitators, office hours and peer groups, with an accessibility contact published.

### 17.2 What the evidence says to do

Strongest support (Dunlosky et al. 2013; Cepeda et al. 2006; Rowland 2014): practice testing and spaced practice. Moderate: doing beats watching (Koedinger et al. 2015, correlational; Chi and Wylie 2014); explanatory feedback beats right or wrong (Shute 2008). Worked examples then fading help novices and can hurt experts (Kalyuga et al.).

The finding that matters most for this course: **people over-rely on AI, and interface design that makes them decide before seeing the AI's answer reduces it more than explanations do** (Buçinca, Malaya and Gajos 2021). A large consulting study found AI helped on tasks inside its ability and hurt correctness on a task outside it, because people over-relied (Dell'Acqua et al. 2023). **No controlled study shows that training improves checking of AI output, in finance or anywhere.** That is the largest evidence gap, and it is also the opening: our pre-test and post-test on unseen planted-error items would be evidence nobody has published.

Things the evidence does not support: matching teaching to learning styles; rereading, highlighting and summarizing; polished lecture video as better teaching; nudges and reminders raising completion at scale (they raised early engagement, not completion); AI explanations making people check more carefully.

### 17.3 What the 11 finance courses cover, and what none cover

Reviewed: Microsoft's five-course finance analysis specialization (about 38 hours), Edureka on Coursera (about 11 hours), CFI (three courses, 1 to 12 hours), AICPA and CIMA (a 2.5-credit self-study and a live 3-hour bootcamp), CPE Credit, Becker, ACCA, a Columbia and Wall Street Prep program, DataCamp, and Microsoft Learn's Copilot for finance.

- **Common:** prompting, tool tours (ChatGPT, Copilot, others), ratio and variance analysis, forecasting, summaries, and a generic lecture on AI risks.
- **Touched at framework level:** governance and controls (COSO, SOX), as a topic.
- **Not seen in any public description:** verification of AI output using planted errors; reconciliations; writing and defending flux commentary; a month-end narrative; a review log with sign-off; a capstone that automates a real recurring task and ships with a control document.
- **Price and length:** free to $29 to $95 for single CPE courses, $159 to $189 for Becker's certificate, about GBP 230 to 310 for ACCA, $295 to $395 for a 3-hour live AICPA workshop, $5,000 for the Columbia program. A 10-hour course sits in the middle of the length range.
- **CPE:** credit comes from a NASBA-registered sponsor, typically 1 credit per 50 minutes of instruction plus a test. NextChapter cannot grant it unsponsored. CFI and AICPA and CIMA do.

### 17.4 What buyers need that most vendors do not publish

From the college and workforce review: learning outcomes, hours and weeks per program; assessment rubrics, answer keys and completion records; participant-level data exports so the college can compute completion and outcomes; an instructor or facilitator guide; an accessibility statement and a named contact; licensing and data-privacy terms; and a review date. A workforce board's training list approves a specific program at a specific college, not a vendor. Workforce Pell requires an accredited institution, a program of 150 to 599 clock hours, state approval and prior operating history, so this course is not a standalone Pell program. Counsel must confirm all of it.

### 17.5 What this changes in the design

1. **Commit before reveal.** In the error hunt and the tie-out, the learner writes their own figure or estimate before the AI draft is shown. This is the design that reduced over-reliance in the research.
2. **Include a task AI gets wrong.** At least one exercise per module sits outside what an assistant does well, so learners find the boundary.
3. **A checker that replies with a specific fix**, as GitHub Skills does, on every artifact: the totals that do not tie, the flagged item missed, the missing disclosure line.
4. **Our own browser spreadsheet for Excel and Copilot exercises.** No paid Copilot or ChatGPT license required for any required task; a free assistant works for the practice tasks. This avoids the licensed-account barrier that excludes laid-off learners.
5. **A pre-test with a skip path and a challenge.** A learner who passes the checking challenge can skip the guided modules and go to the capstone.
6. **A framework with a name.** A short loop (for example Frame, Prompt, Verify, Document) that every module returns to and that the review log records.
7. **Videos are short and optional.** Two to six minutes, informal, a face over a screen or drawing, with transcripts, only where seeing a sequence beats reading. Everything a video teaches is also in text.
8. **Publish the hours, the rubric and the pass rule**, and pass at 80% with unlimited retakes on varied items, matching the standard CFI sets.
9. **Cohort kit.** Facilitator guide, office-hours plan, peer-review rubric, accessibility statement and contact.
10. **Measure the one thing nobody has.** Pre-test and post-test on unseen planted-error items, reported per cohort, with the claim limited to what was measured.

## 18. Plan

Hour figures are the estimates in sections 9, 15 and 16.7: about 360 to 475 hours in all, about 8 to 12 weeks for one person or 5 to 7 for two. The order is built to find out early whether the central idea works.

### Phase 0: decide (about 2 days, no build)

- Name the framework.
- Choose the finance reviewer who signs off every exercise.
- Choose the first buyer to scope against.
- Decide the CPE path: partner with a NASBA-registered sponsor, or skip CPE for the first buyers (most colleges, boards and non-CPA finance staff care more about the certificate and the work sample).

### Phase 1: prove the core in a vertical slice (weeks 1 to 2, about 70 hours)

Build the practice-data generator and the error bank, one module (C3, "Check what AI gives you") with commit-before-reveal, the checker that replies with a specific fix, and the minimum player to run it. Put it in front of the finance reviewer and 5 target learners. **Go or change the design if** learners do not catch more planted errors after the module than before, or if the checker's replies do not tell them what to do.

### Phase 2: foundations and the first finance modules (weeks 2 to 4, about 120 hours)

C1 to C5 and F1 to F3, each with exercises, answer keys, hint ladders and item variants. The tie-out and variance bridge interactives. The pre-test, post-test and skip path.

### Phase 3: the rest and the capstone (weeks 4 to 5, about 90 hours)

F4 to F6, the formula audit in our browser spreadsheet, the review-log builder, the automation canvas, the capstone, the hand-off to the member's work samples, and counts-only reporting for buyers.

### Phase 4: pilot and measure (week 6, about 50 hours)

8 to 12 members in finance roles. Apply the quality gates in section 16.6. Revise any item answered right by under 20% or over 95%, or missed by over a third. Report completion, time on task, and gain on unseen planted-error items.

### Phase 5: package for buyers (weeks 7 to 8, about 40 hours)

Publish hours, rubric, pass rule and outcomes on a public page. Facilitator guide. Accessibility statement and contact. Data export for participant-level reporting. If a college partner is signed, the program dossier that college files for its state training list. If CPE is wanted, the sponsor application.

### Decisions this plan needs from you

1. The framework name, or approval of "Frame, Prompt, Verify, Document".
2. Who the finance reviewer is.
3. Which buyer to scope against first.
4. CPE: pursue now, or defer.
5. Whether to approve the first build once those are settled, since the course scope says no build starts without a signed scope.
