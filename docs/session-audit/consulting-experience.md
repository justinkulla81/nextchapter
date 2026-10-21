# Audit: the "consulting experience screen" session

Read-only audit, 2026-10-18. Nothing was run; findings come from reading code and git.

## Confidence: I cannot name one screen with certainty

No branch or doc contains a page called "consulting experience". The owner's phrase maps to
four things. Ranked:

| # | Candidate | State | Confidence |
|---|---|---|---|
| A | **Experience section of the Market Reality Report** ("Experience checks", "Questions a recruiter will ask") on `origin/claude/friendly-noether-118syi` | Branch only, 2 commits, newest 2026-10-18 00:53 UTC. Branch is based on main at 4ae28002. | 50% |
| B | **Independent work** (consulting, fractional, expert networks, own consultancy) | Merged (live `IndependentWorkSections.tsx`, `src/lib/independent-work/experience.ts`, `src/lib/interim-work/*`); redesign mockup exists | 25% |
| C | **Résumé walkthrough "reviewer question" step** (gap and thin-entry challenges, "There was interim or other work") | Merged | 15% |
| D | **Work history list and form** with engagement type Consulting (on Work Samples and Profile) | Merged | 10% |

Why A is first: the branch's newest commit says "Experience findings: add reviewer objection,
suggested answer and role facts", and the first commit rebuilt the report "as a consulting-style
assessment". "Consulting" there describes the report's register (neutral rating words in the
register of a consulting assessment, `types.ts`), not consulting work. The owner may have meant
"consulting-style experience screen", which fits A. If they meant a screen for consultants'
experience, it is B and D. Please confirm which.

## 1. What it is and where it lives

**A (branch only).** `/dashboard/market-reality` rebuilt into a printable brief with numbered
sections. Section 04, Experience, scores the work history on tenure, gaps, progression, plateau,
level against target and industry breadth. Each check is a finding with a measure, a screening
norm, an assessment (Strength, Adequate, Development area, Not assessed) and an action. Below it,
"Questions a recruiter will ask" lets the member save a one-line answer (`ReviewerExplanationForm`).
URL: https://launchyournextchapter.com/dashboard/market-reality (live version is the old
958-line page; the new one is not merged).
Commit 2 adds to `ExperienceFinding` two fields, `objection` (the reviewer's question) and
`answer` (the shape of a good one-minute answer), and `ExperienceFacts` (latest role, prior
employers, largest team, longest tenure "for the evaluator views"). It touches only
`src/lib/reports/market-reality-brief/experience.ts`. **No screen renders `objection`,
`answer` or `facts` yet** (`ExperienceSection` on the branch reads measure, norm, action only),
and the "evaluator lenses" the comment mentions do not exist on the branch. No test covers
the new fields in that commit.
Related rule inside it: contract, fractional and interim engagements fill the timeline (no gap)
and do not count as short stints; layoffs and similar reasons do not count as unexplained.

**B (merged).** https://launchyournextchapter.com/dashboard/find-my-job (independent work part;
old route `?types=part_time,contract,advisory#independent-work`). Question "Are you already doing
consulting, expert-network, fractional or part-time work?" is asked in complete-profile
(`/dashboard/complete-profile`) and search strategy (`interimConsultingInterest`). Redesign
mockup: `/dev-preview/jobs/find/independent` ("Set up your own consultancy", 4 steps, signups
found in email).

**C (merged).** https://launchyournextchapter.com/dashboard/resume/walkthrough, step component
`src/components/walkthrough/ReviewerQuestionStep.tsx`: "that's wrong / not applicable / leave as
is", and for gaps "There was interim or other work" (adds a fractional or consulting entry).

**D (merged).** `WorkHistoryEntry.engagementType` (FULL_TIME, FRACTIONAL, INTERIM, CONSULTING,
INTERNSHIP); `addWorkHistoryEntry` and `setPrimaryEngagement` in
`src/app/dashboard/resume/actions.ts`; list and form on
https://launchyournextchapter.com/dashboard/work-samples. Concurrent engagements show one at a
time in the Certified Executive Dossier and What They See, and are "never labeled as such
externally".

## 2. Where it fits the redesign

| Piece | Place | Entry | Part |
|---|---|---|---|
| A, experience checks and recruiter questions | Jobs | Get ready to apply | Résumé (as "How a reviewer reads your history") |
| A, the rest of the brief (market, skills, search activity) | Jobs | Market | Your market; already mocked as `/dev-preview/jobs/market/market` |
| A, the member's saved answers | Jobs | Interviews and reviews | Interviews (they are interview answers) |
| A, an earned "your history reads cleanly" fact | Learn | Know yourself | Why hire me evidence / dossier (see 5) |
| B, independent work | Jobs | Find a job | Independent work (mocked) |
| B, fractional and entrepreneur plans | Home | Your week | Journey views `/dev-preview/home/journey/fractional` and `/entrepreneur` |
| C, reviewer question step | Jobs | Get ready to apply | Résumé (replaces `resume/walkthrough`) |
| D, work history with engagement type | Jobs | Get ready to apply | Résumé (inputs); evidence on Why hire me |

Relations. Résumé is where the member edits the history; A is the reading of that history, so it
belongs next to it, not in Market. Why hire me (`/dashboard/strengths`) is the claim side; A's
facts (longest tenure, largest team, prior employers) are evidence for it. Independent work
(B) must stay a Find a job part: D's engagement type is what makes a consulting stint count as
real work in A, which is the one link between B and A that exists today. The fractional journey
home should read "log your first engagement" from D (the mockup already ends there).

## 3. Conflicts

1. **Always positive.** "Reviewer objection" and "Development area" frame the member as
   the subject of doubt. The brief says "a short stint or a gap is never a verdict on a person",
   but `objection` strings are phrased as challenges ("Why did you take a smaller role?",
   "Why has the next step not come?"). Rewrite as preparation: "A reviewer may ask about the move
   to a smaller role. A strong answer: ..." and drop "Development area" for "Ready to explain"
   or "Worth preparing".
2. **No badges.** `AssessmentMark` rating words per row act as tags. Redesign page contract
   allows a row one verdict with its reason; use one plain sentence, not a four-level scale.
3. **One headline, one action, three sections.** The branch report has numbered sections
   01 to 07+ on one long page and a print button. That is "pages merged into one long page"
   (contract 7). It must split by purpose, and Experience alone must be at most three
   sections on first view (headline, the one thing to prepare, the timeline behind "Show more").
4. **Every claim says why.** Measures and norms are stated (good), but the norms are "rules of
   thumb recruiters screen on", unsourced. State the fact each rests on or drop it
   (contract 4). `answer` is advice with no stated reason; add "because ...".
5. **Dossier never locked.** If findings become evidence, they must never show as a
   locked or empty slot; "Not assessed" is a locked-looking state.
6. **Three-way inconsistency on consulting stints.** The independent-work copy says to log them
   "without hesitation" and that they are "never labeled as such externally"; A treats them as
   non-stints but displays them in the timeline with their note. Decide one disclosure rule.
7. **Per-row limit** (title, one verdict with reason, one fact, two actions) is broken by
   measure + norm + action + assessment in a table cell.
8. **Terms.** Branch uses "Resume" and "Development"; redesign uses Résumé. Gap handling is
   duplicated between C (walkthrough gaps) and A (gap check): two screens, two vocabularies,
   same detection.
9. **Branch collision.** `market-reality/page.tsx` is replaced by Jobs > Market in the redesign;
   the branch rewrites that same file (958 lines removed). Merging it as-is deepens the old page.
   Also the redesign flag keeps `/dashboard/market-reality` alive only under Market.
10. **Analytics.** CLAUDE.md requires events with params; the branch uses
    `market_reality_action_clicked`, but none exists for saving a recruiter answer
    (verify `ReviewerExplanationForm`), and nothing for any new objection/answer view.

## 4. Old or does not fit

- The consulting-style long report (numbered sections, print button, tables) is the old
  assessment-document form; the redesign is short rounds and one headline.
- `ExperienceFacts` "for the evaluator views": no evaluator view exists. Dead until built.
- `objection` and `answer` are produced but unrendered: dead code today.
- C's three-way "that's wrong / not applicable / leave as is" and "Confirm, it's a real gap"
  wording reads as an interrogation; "real gap" is judging.
- Two doc lines still call it Personalize (CANDIDATE_JOURNEYS_AND_FEATURES.md:93).
- `Work Samples` page mixes work history and work samples; the redesign has no Work Samples
  place (mockup table does not list it). Its work-history block needs a new home in Résumé.

## 5. New ideas

1. **Findings as dossier evidence.** A clean tenure pattern, a long tenure, a team led, and
   an explained gap with a saved answer are exactly "thoroughness", "self-awareness" and
   "communication" evidence. A saved one-line answer to a reviewer question is a rehearsed
   interview answer: count it as communication evidence and as effort minutes.
2. **Rename it the benefit.** "Questions you can answer in one line" (Résumé) with a payoff
   line: "3 of 4 prepared". Positive, no verdict.
3. **One flow.** Merge C and A's recruiter questions into one "two or three at a time" round
   with why-we-ask first and a finish screen ("your history is ready to explain").
4. **Consulting-specific read.** For members with CONSULTING or FRACTIONAL entries, show
   "Your independent work counts as continuous work" with the reason, and suggest a portfolio
   line (client type, outcome) instead of a gap question. Ties B to Résumé and the fractional
   journey; today they do not meet.
5. **Feed Home.** The single highest-value unprepared question becomes the Your week note
   for a stalled searcher (week 3, no interviews), instead of a new card.
6. **Interview prep link.** Saved answers prefill Interviews > "tell me about a gap".
7. **Print version only on request.** Keep the printable brief as "Download" on Account >
   Documents, not the main view.

## 6. Incorporation steps, in order

1. Ask the owner which screen was meant (A vs B/D). Do not merge the branch before then.
2. Do not merge `friendly-noether-118syi` as-is; rebase its `experience.ts` and tests onto main
   (the market-reality-brief library is reusable, the 958-line page replacement is not).
3. Add tests for `objection`/`answer`/`facts` (none in commit 2) and a "never judging" check:
   no objection text for explained gaps.
4. Reword objection, answer and assessment labels as preparation (see 3.1, 3.2); add the
   "because" to each answer.
5. Prototype in `src/app/dev-preview/` first: Résumé > "Questions you can answer in one line",
   sample data, three sections, one primary action ("Write your answer"). Screenshot for the owner.
6. Absorb C's reviewer step into that prototype; keep one gap vocabulary.
7. State what it removes: the numbered sections and print table from the report, the
   "Development area" scale, and the reviewer step page.
8. Move the rest of the report into Jobs > Market > Your market (already mocked); split by purpose.
9. Wire dossier evidence (idea 1) and the engagement-type read (idea 4) once data is real.
10. Add PostHog events: `experience_answer_saved { detectionType, findingKey, source }`,
    `experience_question_viewed`. Server-side for saves.
11. Add Work Samples' work history block to Résumé; update `docs/candidate-mockups.md`
    (add the screen row and "Replaces").

_Note (2026-10-20): the product has 11 journeys, and the redesign has no Personalize place (its pieces are the strips and the Improve your search page). Where this file says otherwise, it quotes the terms as they were when it was written._
