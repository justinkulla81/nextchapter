# Getting paid to develop AI courses

Written 2026-10-20. The public side is https://launchyournextchapter.com/ai-training (offer) and https://launchyournextchapter.com/ai-skills (proof). This file is the internal plan behind them: who pays, which model, what we build, and what to do first. Nothing here is a quote. **Every dollar figure below is a placeholder to test with the first two buyers, not market-sourced.**

## What we sell

A measured gap and the course that closes it. The gap is already built: the 24-item AI skill taxonomy (`docs/AI_SKILLS.md`), the function-level posting analysis (`src/lib/skills/ai-skill-market.data.ts`), and the counts-only cohort view (`src/lib/skills/cohort-ai-gap.ts`, shown to employers on https://launchyournextchapter.com/employer/learning). What is missing is content we own: today the catalog is 35 curated third-party links, not courses we author.

## Three ways to be paid

| Model | Who pays | What we do | Revenue shape | Best for |
|---|---|---|---|---|
| Course development | College, board, employer | Design and build a course or certificate to their standards; they own and run it | Fixed fee per program, scoped up front | Colleges (continuing ed, exec ed, alumni career services) |
| Grant partner | The applicant (state, board, college, nonprofit) | Named training and reemployment provider inside their application, as subrecipient or vendor | Subaward line for development plus delivery | Workforce boards, AJCs, state AI-workforce money |
| Cohort license | Employer or board | Run platform and courses for a cohort | Per participant for the program length | Outplacement and Learning programs |

Course development is the quickest to a first invoice because it needs no grant cycle. Grant partner is the biggest and slowest, and the repo already encodes the pattern (`src/lib/funding-opportunities/pathways.ts`): they win the money, we are the professional-track provider inside it.

## Placeholder rate card (to test, not to publish)

- Development: a course or short certificate, quoted from scope. My estimate is 80 to 120 hours of design and build for a six-hour self-paced course with assessments. Start the conversation at a range of **$15,000 to $40,000 per course** and adjust after the first two scoping calls.
- Cohort license: **$150 to $400 per participant** for a short program, lower at volume.
- Grant partner: development is a line item in the budget the applicant submits, sized by the same hours.

Decision for you: whether to publish any figure. The public page says "quoted per program" and shows none.

## Who to call first

All of this exists in the admin already, so no new list is needed:

1. **Colleges** ranked as pilot partners for mid-career alumni facing layoffs and AI: https://launchyournextchapter.com/support/admin/crm/colleges. The score already weights what each college's own pages say about AI, reskilling and executive education, so the top of the list is the people already building something. Offer: the alumni AI-gap measurement first, then a development quote.
2. **Workforce boards** with local news on layoffs and AI: https://launchyournextchapter.com/support/admin/crm/workforce-boards. Offer: a grant-partner role in their next AI-workforce or dislocated-worker application.
3. **Layoff employers** already being contacted through outplacement outreach. Offer: AI skills in the transition package, priced per participant.
4. **Funding to watch**: the funding opportunities cron classifies AI-workforce, dislocated-worker and Workforce Pell notices (`AI_WORKFORCE`, `DISLOCATED_WORKER`, `WORKFORCE_PELL`). The one concrete AI reskilling notice in `docs/funding/funding-landscape-2026-10-14.csv` is the DOL rapid reskilling dislocated worker grants, reported at $2M to $8M awards, applications due 2026-08-03 (passed, still to verify). Grants go to applicants, not to us, and we promise no award.

## What the first course is

Pick the track with the clearest demand. From the posting analysis, Applied (using AI inside a non-AI job) is the broadest: it is the track for Finance, Operations, Sales and Marketing postings. Proposed first build: **AI in your function**, one course per function family, each with the same spine:

1. The AI skills this function's postings ask for most (generated from the data, so the course updates when the data does).
2. Three practice tasks on realistic work, ending in a work sample that counts as evidence on the member's profile (`src/lib/evidence/ai-work-samples.ts`).
3. An assessment that is rule-based, so it costs nothing per learner. The optional AI review of a sample costs about $0.006 each with a $50 monthly cap, and stays opt-in.

Leading AI teams has no course today (`docs/AI_SKILLS.md`, Known limits). A leadership track for managers is a natural second build and the one colleges' executive-education arms buy.

## Risks

- **We are not an accredited provider.** WIOA individual training accounts require the state's eligible training provider list, and Workforce Pell goes to accredited colleges. Selling to colleges and boards as their development partner avoids needing it ourselves. Do not claim WIOA eligibility for our own courses.
- **Outcome claims.** Postings asking for a skill is demand, not proof that a course raises pay. The public pages say so. Keep it that way in proposals.
- **Metered cost.** Course content is a one-time build. Delivery stays rule-based. Any feature that calls a model per learner needs a cost line before it ships.
- **Capacity.** Each course is real build time. Take at most two paid builds at once until one has shipped.

## First 30 days

1. Apply the SQL file for the weekly AI-share snapshot (`prisma/manual/2026-10-20-ai-share-snapshot.sql`) so the trend starts accruing.
2. Send the top 10 colleges from the ranked list the alumni-gap offer, using the standard positioning line.
3. Scope one paid pilot with one college and one board; write each quote from the hours estimate above.
4. Build the first course on a free-or-paid pilot basis only after a signed scope.

## Decisions (2026-10-20)

- **Price:** none published. The public page says "quoted per program". Quote each program from the hours estimate until two scoping calls have been held, then revisit.
- **First build:** the Applied track, "AI in your function". The leadership track is the second build.
- **Grants:** pursue the grant-partner route when a specific AI-workforce or dislocated-worker notice opens, by writing the training section for the applicant. Do not chase grants speculatively.
- **Capacity:** at most two paid builds at once.
