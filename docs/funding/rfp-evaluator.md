# RFP and grant evaluator / completer: what it needs to know

Written 2026-11-24. Covers every RFP, bid, grant and program in the database. Part 1 is what is there and in what shape.
Part 2 is what the evaluator has to know to say whether NextChapter should pursue an opportunity. Part 3 is what the completer
needs to fill in a response. Part 4 is the build order.

Sources: production counts on 2026-11-24, and a full read of 7 current solicitations (PacMtn WA, NH DBEA WIOA Youth, Workforce
Solutions Coastal Bend TX RFP 26-01, MassHire Metro North RFI and RFQ, Workforce Solutions North Central PA "PA Six Careers" RFQ,
EDA Build to Scale FY27 NOFO, Lehigh Valley WIB RFQ), plus a secondary summary of Capital Area NCWorks RFP 26-059.

## 1. What is in the database

| Pool | Table | Rows | "Open" | What a row knows |
|---|---|---|---|---|
| Federal grants and solicitations | `FundingOpportunity` (Grants.gov, SAM.gov) | 7 | 6 | Title, agency, applicant types, eligibility class, close date, award ceiling |
| Workforce board bids | `BoardBid` (board procurement pages) | 1,267 | 180 | Title, link, board, a deadline on 13 of the 180 |
| Grants, programs, accelerators, contests | `CrmOpportunity` in the `grants` pipeline | 1,591 | 1,591 (all "Identified") | Title, URL, funder org, eligibility class, a route note, deadline (1,522) |
| Competitor federal wins | `CompetitorAward` | 1,292 | n/a | Who won what, for how much |

Problems the evaluator has to work around:

- **Nobody has read the documents.** Every verdict so far comes from a title or a search snippet. The sales plan already says
  so ("We have not read the RFPs themselves... scores are from titles"). The 7 documents read for this note showed that title
  scoring misses the knockouts: in-state location (NH), staffing a job center (NH, Capital Area), insurance minimums (Coastal Bend),
  individuals only (MassHire RFQ), for-profits barred (EDA).
- **`BoardBid` "open" is mostly not open.** Of 180: 167 have no deadline. The list includes attachments filed as bids (budget
  forms, Q&A answers, "RFP Inquiry Period Ends"), one RFP split into many rows (the Pocono board's RFP and its forms are 10 rows), county purchasing unrelated to
  workforce (roofs, tennis courts, jail food, trash bags), and 2021-2024 PDFs that are long closed. `bidFitsUs` sorts by title
  but nothing closes a row.
- **`CrmOpportunity` amounts lost their units on 361 of 578 rows that have one.** "$25K" is stored as 25 and "$2M" as 2
  (Rhode Island incumbent worker training 1–25, Delaware WIOA 2–2). Anything between 1 and 999 is unusable as dollars.
- **109 grants-pipeline rows were never opened at the source** ("Verify on the official page (listed from search results...)").
- **The pipeline mixes kinds.** Grants, accelerators, pitch contests, revenue-based lenders, awards and tax credits sit in one
  "grants" list with one stage. They are evaluated differently (an accelerator has no RFP; a tax credit has no deadline).
- **Federal eligibility is read from applicant-type codes, which overstate fit.** Both SBDC notices are marked "we can apply"
  (SBDCs are run by colleges and states), the NIH T15 biomedical training grant is "we can apply", and an FDA food-safety
  "rapid response teams" grant matched on the phrase "rapid response". Eligibility and fit are separate questions and the
  evaluator must ask both.

## 2. The evaluator: what it must know to decide

The evaluator reads the actual document (PDF or page, with `unpdf`) and fills a **requirements profile**. A verdict comes from
the profile plus NextChapter's company facts (section 3), never from the title alone. Every field records the sentence it came
from, so a verdict can be checked.

### 2a. The requirements profile (read from the document)

| Group | Fields | Seen in the 8 documents |
|---|---|---|
| Kind and status | RFP / RFQ / RFI / grant NOFO / forecast / accelerator / contest / ETPL; open, closed, or an attachment of another bid | All |
| Dates | Due date and time zone, questions deadline, Q&A posting date, pre-bid conference (date, required or optional), proposal validity (90 / 180 days) | All |
| Submission | Email, portal (Bonfire, OpenGov, sfgrants.eda.gov), paper; file format; subject line; signature (wet / e-sign) | All |
| Who may apply | Applicant types; for-profit allowed (explicit, implicit "consultants or firms", or barred); individuals only | All; for-profit barred 1 (EDA), individuals only 1 |
| Place | Must be located in the state; state vendor or Secretary of State registration; in-state preference; regional knowledge scored; on-site delivery or job-center staffing | Hard in-state 1 (NH); preference or scored 3; on-site 3 |
| Compliance gates | Debarment / federal-funds eligibility; SAM + UEI; insurance minimums by line (GL, E&O, auto, workers' comp); state tax / UI / child-support good standing; bankruptcy within 7 years; prior termination for cause; single audit; conflict-of-interest; accessibility (WCAG 2.1 AA, VPAT) | Debarment 6 of 8; insurance amounts 1 (GL $500k/$1M, E&O $1M); tax good standing 2; audit 2 |
| Money | Contract type (fixed, deliverable, per participant, performance-based share, cost-reimbursement); ceiling or NTE; rate caps ($815 a day at PacMtn); match (EDA 1:1); term and renewals; payment timing (reimbursement, no advances) | Cost-reimbursement 3; performance-tied pay 1; match 1 |
| Scope | Services; population (youth, adult, dislocated, professionals, employers); outcome measures (WIOA indicators and targets); deliverables; staffing required | All |
| Scoring | Each criterion and its points; bonus points (Texas HUB +5); minimum score (below 70 = non-responsive); pass/fail completeness screen | 7 of 8 give weights |
| Response contents | Sections in required order with page limits; forms and attachments; references (count, years); résumés; org chart; budget form and narrative; samples | See 3b |
| Contacts | Procurement contact, email, phone | All |

### 2b. Gates (any "no" ends the evaluation, with the reason shown)

1. For-profit allowed, or a named eligible prime NextChapter could sub under. If neither: **No** (EDA Build to Scale: only as a
   contractor procured by an eligible applicant).
2. Not individuals only (MassHire instructor RFQ).
3. In-state location or registration: met, or can be met before the due date (foreign qualification takes days to weeks).
4. No on-site staffing or in-person delivery NextChapter cannot staff.
5. Insurance lines and minimums held, or bindable before award.
6. Set-aside or certification held (HUB, WOSB, MBE...). A bonus-point certification is a score cost, not a gate.
7. Match required: only if a partner can supply it.
8. Cost-reimbursement cash flow: the ceiling ÷ term is within what NextChapter can float (an owner number, section 3).
9. Time: days to due date ≥ the effort the response needs (a 2-page RFQ: 2 days; a WIOA program RFP: 3+ weeks).
10. Past performance demanded by the gate (NH: 2 years of WIOA outcome history) is held.

### 2c. Fit (for what passes the gates), 0–100 and a route

| Factor | What it reads | Weight (start; tune on outcomes) |
|---|---|---|
| Scope match | The scope against what NextChapter delivers: career transition for managers and professionals, AI reskilling courses, layoff-response platform and seats, coaching, labor-market data. Youth programs, job-center operation, web-agency, finance or audit work score low. | 30 |
| Population match | Dislocated, professional, incumbent white-collar workers high; youth and entry-level low | 15 |
| Scoring criteria we can win | Points where NextChapter is strong (approach, technology, cost per participant) against points it will lose (regional knowledge, references, WIOA outcome history, HUB) | 20 |
| Size against capacity | Value worth the response effort, and not beyond what the team can deliver | 10 |
| Relationship | CRM warmth with the issuer or the likely prime; a board we already demoed | 10 |
| Competition | Incumbent and competitor wins at this buyer (`CompetitorAward`, vendor footprints) | 5 |
| Strategic value | First reference customer, a Reskill-grant state, a high-layoff board, a door to ETPL | 10 |

**Verdict:** Go / Go as subcontractor (names the prime) / Respond to RFI (no contract, but it builds the vetted pool) /
Watch (forecast or next cycle) / No. **Route:** prime, sub under a named prime, partner applies (grant), ETPL, small purchase.

### 2d. The open items read for this note, scored by hand

| Opportunity | Due | Verdict | Why |
|---|---|---|---|
| MassHire Metro North RFI: AI Training Providers | Nov 30 priority, rolling | **Go** | 8 pages, no gates; asks for track record, AI curriculum, accessibility, cost per participant. MA-based preferred. |
| North Central PA "PA Six Careers" RFQ | Dec 15 | Possible | No formal gates; $45k NTE, part paid on completions; 50 employers onto a career platform; regional knowledge is 20 points we would lose. |
| PacMtn WorkEx Strategic Resourcing | Dec 4 | No | Open to firms, but the work is funding-strategy consulting, not our product. |
| Coastal Bend RFP 26-01 Website | Nov 30 | No | Web-agency work; Texas tax and UI compliance; E&O $1M. |
| NH WIOA Youth RFP | Jan 25 | No | Must be located in NH; statewide youth case management in job centers; 2 years of WIOA outcomes. |
| EDA Build to Scale FY27 | Feb 26 | No (sub only) | For-profits cannot apply; 1:1 match; technology commercialization. |
| Capital Area NC adult and dislocated worker | Closed Jun 9 | No | Staffing an NCWorks center; audit statements. |

## 3. The completer: what it needs to fill a response

### 3a. Company facts (held once, reused on every response)

Kept in the database behind admin login, never in the repo. Items marked **owner** are not known to the app today.

- Legal name, entity type, state and date of incorporation, address, EIN (**owner**), signer and title (**owner**), headcount
  (**owner**), parent or subsidiary.
- SAM.gov registration and UEI, expiry (**owner**: status unknown). W-9 (**owner**).
- States where registered to do business or as a vendor (**owner**).
- Insurance in force by line and limit, carrier, certificate (**owner**: none on file). Documents asked for GL $500k/$1M,
  E&O $1M, auto, workers' comp.
- Certifications: small business size, HUB, WOSB, MBE, VOSB (**owner**). `NEXTCHAPTER_PROFILE` in
  `src/lib/funding-opportunities/eligibility.ts` lists none.
- Financial statements or audit, internal-controls description, indirect rate (15% de minimis), how much cost-reimbursement
  can be floated (**owner**).
- References: 3 from the past 5 years, each with contact, services, term, value (**owner**: the sales plan says references
  come from the first two buyers, so there may be none yet).
- Past performance with outcomes (participants, placements, skill gains). Platform data can supply counts once a pilot runs.
- Key staff: résumés, degrees, certifications, named project manager, org chart (**owner**).
- Pricing: rate card (hourly and daily), per-participant course price, pilot price (**owner**: the sales plan says no price
  exists; placeholders $15k–$40k per course build and $150–$400 per participant were never tested).
- Standard certifications as signed text: debarment, lobbying (CD-511 / SF-LLL), drug-free, WIOA Section 188
  nondiscrimination, conflict of interest, litigation disclosure, no bankruptcy in 7 years (**owner** confirms each is true).
- Accessibility: WCAG statement and a VPAT/ACR for the platform (to produce).
- Data security: the security questionnaire answers (the CASA work).

### 3b. Content library (reusable answers, drafted once, edited per response)

What the documents asked for, by how often (of 8): approach and work plan 8; qualifications 8; cost proposal 8; cover sheet 6;
references 5 (usually 3 from 5 years); debarment, lobbying, drug-free 5; key-staff résumés 5; conflict of interest 4;
budget narrative 3; org chart 3; samples (curriculum, work, VPAT) 3; past WIOA outcomes 2; audit or financials 2; support or
match letters 2; SF-424 set 1.

Library entries: organization description (uses the mission and vision exactly as written in `CLAUDE.md`), the professional
dislocated-worker approach, the AI reskilling curriculum and sample module, layoff-response platform description, accessibility,
data handling and privacy, outcome measurement and reporting, partnership with boards and job centers, budget narrative
templates (fixed, per participant, performance-based).

### 3c. What the completer produces per opportunity

1. **Compliance matrix**: every requirement from the profile (section, page limit, form, certification, attachment, format,
   signature) with status: filled from facts, drafted, missing fact (names it), owner action (sign, notarize, upload).
2. **Draft narrative** in the document's required order, each section sized to its page limit and written to its scoring
   criterion, with the points shown beside it. Claims come only from company facts and the library; anything else is flagged.
3. **Budget** from the rate card in the form the document wants (rates × hours by task, per participant, performance share),
   checked against caps and the ceiling.
4. **Questions to ask** before the questions deadline (ambiguities found while filling: for-profit eligibility, remote delivery).
5. **Calendar**: questions deadline, conference, due date, as CRM deadlines and tasks.

It never submits and never signs. The owner submits.

## 4. Build order

1. **Company facts and content library** (an admin page and a table). Nothing else works without them; most items are owner
   answers.
2. **Document reader**: fetch the bid or NOFO, extract text, fill the requirements profile with Claude (`@anthropic-ai/sdk`,
   already a dependency), each field with its source sentence. Closes attachments, duplicates and past-due rows in `BoardBid`.
3. **Evaluator**: gates and fit score as pure functions (testable, like `eligibility.ts`), shown on `/support/admin/crm/funding`
   with one primary action per row ("Draft response" on a Go).
4. **Completer**: compliance matrix, drafts, budget, exported as a doc the owner edits.
5. **Clean-up in the same work**: fix the 361 unit-less amounts (re-read from the source text), split the grants pipeline by kind,
   correct the federal fit (SBDC, NIH T15, FDA).

**Data budget.** The evaluator reads only open rows: ~180 `BoardBid`, ~6 `FundingOpportunity`, and grants-pipeline rows with a
future deadline, narrow columns (~250 B each), once a day: under 1 MB a day. The stored profile is a few KB per opportunity and
is read one at a time. Documents are fetched from the issuers' sites, not the database. Well under the 0.5 GB a day line.
Claude calls: one read per new document (a few dozen a day at most) and one draft per response asked for.

## 5. What was built (2026-11-24)

- `src/lib/bid-evaluator/`: `facts.ts` (company facts and answer library, keys and parsers), `profile.ts` (what is read from
  each document), `evaluate.ts` (gates, fit, verdict, route; pure, tested in `src/test/bid-evaluator.test.ts`), `fetch-doc.ts`
  (listing page → the linked RFP PDF; Grants.gov → synopsis and the NOFO attachment), `read-doc.ts` (Claude fills the profile,
  each group with its source sentence), `context.ts` (past winners from `CompetitorAward` and the document, competitors named
  in the text, possible primes and partners from the CRM and the board directory, warm contacts at the issuer), `draft.ts`
  (the completer), `run.ts`, `store.ts`.
- Pages: `/support/admin/crm/funding/evaluator` (queue, verdicts, "Read the next 3"), `/support/admin/crm/funding/evaluator/<id>`
  (answers, gates, past winners, partners, fit, "Draft the response", Markdown download), `/support/admin/crm/funding/company-facts`.
- Tables: `BidCompanyFact`, `BidContentBlock`, `BidEvaluation` (`prisma/manual/2026-11-24-bid-evaluator.sql`, applied).
- Every evaluation answers the same questions: must we be on a training list (and how to get on it); can we subcontract and
  under whom; only for colleges; who is trained or served; what is trained; what results are required; eligible for training,
  software, coaching (each separately); years in business required against ours; SOC 2 required against ours; who has won before.
- Reads run on an admin's click (one document fetch and one Claude call each); no cron. Saving company facts re-scores the stored
  profiles without reading documents again.
- Not done here: the 361 unit-less grant amounts and the `BoardBid` rows that are forms, answers or long closed are left as they
  are (rewriting existing rows needs the owner's OK). The evaluator marks those rows "Not a bid" or "Closed" in its own table.
