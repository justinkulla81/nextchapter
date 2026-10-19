# Session audit: "Consulting experience screening questions"

Read-only audit, 2026-10-18. Source: the full transcript of session
`session_01AyjT9hWX5DDDh7MAcy8ohF` (created 2026-10-15 20:13 UTC, last update
2026-10-16 01:51 UTC, status idle, waiting on the owner). Repo state checked with git.

This corrects `docs/session-audit/consulting-experience.md`. That audit guessed (about 50%)
the Experience section of the market report. **That guess was wrong.** The session has nothing
to do with the market report or the recruiter-questions findings.

## 1. What the "screening" is

The owner's only opening message, verbatim (it is cut off mid-sentence in the transcript):

> need to ask if peopel are already doing consulting and/or expert / fractional / partime..
> check email to lighten the load, but we want to see if they are doing now, have done it.
> this is a personalize

So it is **not** a screen of consultants and not a partner portal. It is one question added
for **candidates** on the existing Search Strategy page, in the section "Other ways to
strengthen your search". What it is for: personalization. The answer tells the product which
candidates already do independent work, so the journeys and job suggestions can fit. The
transcript does not say more about the owner's intent than the quote above; the rest is the
session's own reading ("your message cut off at 'this is a personalize', so I guessed").

### The question as built

- Replaces the old yes/no "Have you done part-time/interim work or consulting?".
- Four rows, each with three adjacent buttons: **Doing it now / I've done it / Not yet**.
  Rows: Consulting or freelance projects; Expert network calls and research; Fractional or
  interim roles; Part-time work.
- Rows come pre-selected where evidence exists, with a note like "We saw GLG, Upwork. Change
  this if it's not right." The candidate confirms or changes each row.
- Prefill sources: (1) Gmail platform tracking, counting only "working or earning" emails
  (sign-ups, acceptances, dismissed detections do not count); activity in the last 60 days
  reads as "now", older as "past"; (2) logged work-history entries typed consulting,
  fractional or interim ("now" if current). If they disagree, "now" wins.
- Expert-network and AI-training platforms both map to "expert network"; freelance
  marketplaces map to "consulting".
- Candidates without Gmail connected see blank rows.
- All four rows are required before the section saves.
- Legacy boolean `triedPartTimeOrConsulting` is now derived from the answers, so the
  checklist and sprint scoring still work.

## 2. What the session produced, and where it lives

| Item | Where |
|---|---|
| Code, 1 commit `d1fa5ebc` | branch `origin/claude/sharp-hawking-yns4xu` (already merged) |
| Pull request #46 | https://github.com/justinkulla81/nextchapter/pull/46, merged to `main` as `e6d115fe` |
| Pure logic | `src/lib/independent-work/experience.ts` |
| Question component | `src/components/dashboard/IndependentWorkExperienceQuestion.tsx` |
| Wiring | `src/app/dashboard/search-strategy/page.tsx`, `src/app/dashboard/complete-profile/actions.ts` |
| Tests | `src/test/independent-work-experience.test.ts` (unit tests of the prefill) |
| Column | `CandidateProfile.independentWorkExperience Json?`; `prisma/manual/2026-10-15-independent-work-experience.sql` |
| PostHog event | `independent_work_experience_answered`, server-side, carries the four answers and which rows were prefilled |

Page: https://launchyournextchapter.com/dashboard/search-strategy

Not produced: no question list document, no spec, no mockup, no artifact, no screenshot, no
`/dev-preview/` page. The session never ran the page in a browser (it says so twice).

Database side effect: after the owner said "yes, add the column to this database" the
session ran `ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "independentWorkExperience" JSONB`
on the Supabase project "NextChapter - Claude" (`uvoulytrsrxasqzutlmq`), recorded in its
migration history as `independent_work_experience`. The session could not tell whether that
project is production. Risk it named: the manual SQL file and the Supabase history can drift.

## 3. Decisions and open questions

Owner decisions, in the owner's words:
- "open a pull request for this"; "yes, watch the PR"; "merge the pull request".
- After the session warned that merging could break every `CandidateProfile` read until the
  column exists, the owner chose to apply the SQL first, then: "SQL is applied, merge it".
- "check that the PostHog event is firing"; "check the Postgres mirror via Supabase";
  "yes, add the column to this database"; "check PostHog again for the event".
- Later: "I saved it, check PostHog again", then "i have no idea hwat you want".

Assumptions the session made without the owner confirming (it listed them; the owner
never answered):
- Placed on Search Strategy, not onboarding.
- Four rows, all required.
- Expert network includes AI-training platforms; freelance counts as consulting.
- Email evidence only for Gmail-connected candidates.

Open as of the last event (2026-10-16 01:51 UTC):
- **Not verified in production.** Two PostHog checks (2 days of data) and two database
  checks show 0 `independent_work_experience_answered` events, 0 mirror rows, and 0 profiles
  with a saved answer. The owner says they saved; no trace exists. Pageviews do arrive
  (175). Causes the session listed but did not test: the deploy lacked the change, the
  owner saw the old yes/no (page not updated), the save errored, the app writes to a
  different database than the one checked, or `NEXT_PUBLIC_POSTHOG_KEY` is missing server-side.
- The session asked the owner to say which of three things they see in "Other ways to
  strengthen your search": four rows with three buttons, the old Yes/No, or an error after
  Save. The owner replied that they did not understand, and the session simplified the ask.
  Nothing further is in the transcript.
- Whether the Supabase project it altered is production: unanswered.
- The transcript does not show the owner confirming the question wording, or whether the
  question should also appear in onboarding.

Side note for the code owner: on `origin/main` the live page and action already use the
new fields, so the quickest check is whether the deployed build includes `e6d115fe`.

## 4. What this means for the candidate-site redesign

Redesign decisions used: Home, Jobs, Network, Learn, Finances and benefits (money opt-in),
Account and privacy, Help; personalization as the first strip; question bundles of at most
three with a receipt of what improved; always positive; no badges; 11 journeys including
fractional and entrepreneur; every claim says why.

### Where it fits
- It is exactly the "one-off question on search strategy" that `docs/candidate-redesign.md`
  (flows table, line 52) says must become a "question with the payoff shown"
  (`/dev-preview/flows/tune-question`). It is a personalization question, so it belongs in
  the strip (Build your plan on Home, Better jobs for you on Jobs) and on the Improve your
  search page, not on a standalone Search Strategy card.
- It is the missing signal for the **fractional** and **entrepreneur** journeys, and for
  journey routing generally. Doing now / done / not yet tells which journey view to lead with.
- Prefill from email with "we saw GLG, Upwork, change this if wrong" is a good "every claim
  says why" pattern: the evidence is shown beside the answer.
- Three adjacent buttons per row follows the project's design principle (2 to 4 options).
- The server-side event with params follows the CLAUDE.md analytics rule.

### Conflicts
1. **Bundle size.** Four required rows is more than "at most three questions at a time".
   Split into a first round (consulting, fractional) and a second (expert network,
   part-time), or make the type list one multi-select then ask "now or before" only for the
   ones picked.
2. **No receipt, no payoff.** The page shows no "what improved" line. Add one: for example
   "Contract and fractional roles now appear on your board", true only if the board really
   changes.
3. **"Not yet" is a negative.** Always-positive rule: use "Haven't tried it" or "Curious
   about it", and make a "Curious" answer feed the entrepreneur/fractional journeys.
4. **No "why we ask" first.** The redesign requires it before the question.
5. **Required rows block saving.** The redesign flows are optional and forgiving; a required
   four-row answer is a gate. Allow skipping a row with "Skip for now".
6. **Old home.** It sits on the old Search Strategy card, which the redesign replaces.
   `dev-preview` has no mock of it, and CLAUDE.md says to mock first and screenshot.
7. **Gmail framing.** Reading email to pre-fill touches Account and privacy: show what was
   read, offer "Don't use my email" there, and keep the evidence wording specific.
8. **Duplicate asks.** The independent-work mockup (`/dev-preview/jobs/find/independent`) and
   the complete-profile flow ask a similar thing; there should be one stored answer.

### Old or dead
- The legacy `triedPartTimeOrConsulting` boolean is kept only for the checklist and sprint
  scoring. Retire it with those.
- The manual SQL file plus the Supabase-side migration is a double record.

### Corrections to the earlier audit
- Its candidate A (Experience section of the market report, branch
  `claude/friendly-noether-118syi`) is **not** what the session was. Drop it from the
  "which screen" confusion; no recommendation in it applies to this session.
- Its candidate B (independent work) was the nearest, but it said B was "merged live" under
  `IndependentWorkSections.tsx`; the real subject is the new per-type question merged in PR #46.
- Its step 1 ("ask the owner which screen was meant") is now answered by the transcript.

## 5. New ideas

1. **Use the answer to route the journey.** Doing now = fractional/consulting journey home;
   done before = "restart your independent work" prompt; haven't tried = entrepreneur
   or "try one engagement" nudge.
2. **Receipt after save**: "Roles on your board that suit consulting: N", and which strip
   improved.
3. **Evidence line stays visible** after confirming, as the "why" for later claims such as
   "because you consult now, we show interim roles first".
4. **Feed Network**: expert-network "now" is an invitation to the expert-circle in Network.
5. **Feed Finances and benefits**, only after the money opt-in: independent income changes
   health cover and quarterly tax questions. Do not ask money questions here.
6. **One event, one place**: add `independent_work_experience_viewed` and
   `independent_work_prefill_changed { type, from, to, evidence }` so overrides of the
   email guess can be measured.
7. **Verify with a test candidate** before any redesign work, since nothing has been saved
   in the database yet.

## 6. Suggested next steps

1. Confirm the build on production contains `e6d115fe` and that the owner sees four rows.
2. Save once, then check the event and the `independentWorkExperience` column. If still
   empty, test the action directly.
3. Mock the question in `src/app/dev-preview/` as a three-question bundle with why-we-ask
   and receipt; screenshot; say what it removes (the Search Strategy card section).
4. Decide which Supabase project is production and reconcile the column record.

## Not in the transcript
- Any reply from the owner to the three-option question.
- Any wording or list of questions beyond the four rows built.
- Any mention of recruiters' clients, partner portal or the market report.
- Any browser run, screenshot or artifact link.
