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

1. **On the platform** (the Learning page renders the course, completion and work samples land in the member's evidence). No cost to the buyer's IT.
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
