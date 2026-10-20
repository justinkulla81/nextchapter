# Journey audit: does every journey have the right data, personalization, actions and features?

Audit date: 2026-10-17. Read-only audit of the code on branch HEAD `1d5bd4b9`. Every statement below comes from code I read; where I looked and did not find something I say "not found". Code references are file paths in the repo. Pages are given as full URLs on https://launchyournextchapter.com.

Older docs (`docs/CANDIDATE_JOURNEYS_AND_FEATURES.md` listed 8 journeys (fixed 2026-10-20, it now lists all 11), `docs/CANDIDATE_MENU.md` marks "Reviews and raises" as shown to all) have drifted from the code. This file follows the code.

## Summary

**Best served:** Laid off (LAID_OFF), then Thinking about a move (EXPLORING_MOVE) and Going for a promotion (PROMOTION). These have their own first-week plan, a time-based search playbook, a Market Reality framing, a driver or in-work workspace, and a confidential default that fits. Student or new grad (STUDENT_NEW_GRAD) has the only dedicated page and Home module of its own (the early career plan), but no internships outside a college portal.

**Worst served:** Building something of my own (ENTREPRENEUR), Taking a break (TIME_OFF), Changing careers (CAREER_CHANGE) and Happy with fractional work (FRACTIONAL). ENTREPRENEUR collects nothing about the venture and its plan steps point nowhere. TIME_OFF collects one date. CAREER_CHANGE has the tools (Pivot paths, skills matrix, trends card) but the code never connects them to the journey. FRACTIONAL has a good plan but no pipeline, and its only door to client work is a locked tab.

**Biggest gaps (details in each journey and in "Cross-cutting findings"):**

1. **The four not-searching journeys (GROWING, ENTREPRENEUR, FRACTIONAL, TIME_OFF) inherit job-search defaults.** Same required Search Strategy gate (target role, company size, blockers), same seven-step first week ("Save your first job"), same Candidate+ rule (5 applications, 480 minutes), full weekly points pace, and no stage or journey filter on the daily, midweek and Friday progress emails. Only `searchIntensity = casual` switches this off, and these members are never asked it.
2. **Changing careers is not wired to the pivot tools.** Choosing the journey does not set `isPivoting` or `targetFunction`; job matching then ranks against the current function. "Map your transferable skills" is plain text with no destination. Pivot paths exists in the Jobs place for everyone but is only prominent when a Search Strategy checkbox is ticked.
3. **Independent work (NEXT_ACT, FRACTIONAL, bridge work for RETURNING and CAREER_CHANGE) sits behind a locked tab and a mismatched confidential default.** The whole independent-work toolkit lives on the Find a job page, whose tab is locked in Exploring, On leave and Portfolio. NEXT_ACT and FRACTIONAL default to Confidential Search Mode ON through the legacy job-status route, which hides Candidate+ and blocks supporters, against `confidentialByDefault: false` in `journey.ts`. No client or engagement pipeline exists beyond three `journeyDetails` keys.
4. **Managing my career (GROWING) is the journey built for reviews and raises, but is excluded from the Reviews and raises workspace.** `IN_WORK_JOURNEYS` is PROMOTION, EXPLORING_MOVE, NEXT_ACT. The tab is hidden for GROWING and the review-cycle emails skip them; the workspace page tells them it is "built for people who have a job and want to grow in it".
5. **Thin data for several journeys, and no wellbeing tailoring anywhere.** Nothing is collected about the venture (ENTREPRENEUR), the break (RETURNING: reason, length), the leave (TIME_OFF: reason, funding), or the target field at onboarding (CAREER_CHANGE). The last day worked (LAID_OFF), which drives the search clock and the unemployment runway, is only asked on the Got an offer page. The mood prompt and Support page are the same for every journey.

## Shared mechanics (apply to all 11 unless a journey says otherwise)

### How someone enters a journey

- **Onboarding situation step** (`src/components/onboarding/SituationForm.tsx`, action `updateSituation` in `src/app/onboarding/actions.ts`). 13 card keys map to 11 journeys (`SITUATION_TO_JOURNEY` in `src/lib/constants/onboarding.ts`). `just_laid_off` and `just_resigned` both give LAID_OFF; `ready_to_move` and `worried_let_go` both give EXPLORING_MOVE. Only the journey is stored, not the card key, so a persona page that says "worried about being let go" does not preset `moveDriver`.
- Then: résumé upload, "confirm what we read" (level, function, target role, industries, years, career stage choice), location and search status (`LocationForm`), contract, score, account, welcome. Onboarding start URL: https://launchyournextchapter.com/onboarding
- **Other ways in:** outplacement seat gives LAID_OFF at APPLYING (`src/lib/employer/outplacement-enrollment.ts`); growth or learning seats give GROWING at STAYING when no journey is set; check-in answers "I was laid off" (LAID_OFF/APPLYING), "I'm back at work after a break" (GROWING/STAYING), "I'm doing fractional work and I'm happy" (FRACTIONAL/STAYING) in `changeForAnswer`; 90 days after LANDED the member is moved to GROWING/STAYING by the cron `landed-to-managing` (`src/lib/journey/auto-advance.ts`); a college can report laid off; legacy members get a journey from `currentJobStatus` (`FROM_JOB_STATUS`). The in-app check-in pop-up (`JourneyCheckInDialog`) only offers 7 answers; "back" and "fractional" exist in the model but are not in the pop-up.
- **Editing later:** "Your situation" selector on https://launchyournextchapter.com/dashboard/privacy lets a member pick any journey and any of the 7 stages. Code only checks that the stage exists, so every journey x stage combination is valid. The combinations the design actually handles are listed per journey below.

### Stages (JourneyStage)

EXPLORING (check-in every 30 days), PREPARING (14), APPLYING (7), INTERVIEWING (7), OFFER (7), LANDED (90), STAYING (30). PAUSED is legacy and reads as STAYING.

### Menu modes (src/lib/journey/menu.ts) and what they lock

I ran `itemVisibility` for every mode. "Locked" = muted tab with a reason and a status-update box; "hidden" = gone.

| Mode | Used by | Locked | Hidden (besides the other modes' grow/career items) | Pillar order starts |
|---|---|---|---|---|
| EXPLORING | stage EXPLORING | Find a Full-time Job, Interview Prep, Got An Offer, Executive Recruiter | none | Personalize, Prove it, Network |
| PREPARING | stage PREPARING | Got An Offer | none | Personalize, Prove it, Search |
| ACTIVE | APPLYING, INTERVIEWING, OFFER, no stage | none | none | Personalize, Prove it, Search |
| STAYING | stage STAYING; also PROMOTION while EXPLORING or PREPARING | Find a Full-time Job, Interview Prep, Got An Offer | Know your worth (replaced by the "grow" item), Executive Recruiter, Find Interim Work, EQoverIQ, Benefits | Manage your career |
| LANDED | stage LANDED | none | Find a job, Interview Prep, Recruiter, Higher Ed benefits, Interim, EQoverIQ, Benefits | Manage your career |
| PORTFOLIO | FRACTIONAL at STAYING | Find a Full-time Job, Got An Offer | Recruiter | Work now |
| LEAVE | TIME_OFF at STAYING | Find a Full-time Job, Interview Prep, Got An Offer | Recruiter, Interim, EQoverIQ | Personalize |

Default mode by journey at its default stage: LAID_OFF ACTIVE; EXPLORING_MOVE EXPLORING; GROWING STAYING; PROMOTION STAYING; CAREER_CHANGE EXPLORING; STUDENT_NEW_GRAD PREPARING; RETURNING PREPARING; NEXT_ACT EXPLORING; TIME_OFF LEAVE; FRACTIONAL PORTFOLIO; ENTREPRENEUR STAYING.

Note on the six places (`src/lib/nav/places.ts`): only some tabs carry menu rules. `interim` and `eqoveriq` ("Work now") are not tabs; Find Interim Work is a redirect to https://launchyournextchapter.com/dashboard/find-my-job?types=part_time,contract,advisory, so it is reached through the Find a job tab, which is locked in EXPLORING, STAYING, PORTFOLIO and LEAVE.

### Effort, Candidate+ and pace

- Candidate+ needs: 480 minutes of search effort (`DOSSIER_EFFORT_MINUTES_TARGET`, admin override per member), one assessment, 5 outreach or networking messages, 5 applications (`src/lib/scoring/dossier-targets.ts`, `candidatePlusRequirements` in `src/lib/unlocks/ladder.ts`). No journey or stage input found in `dossier-unlock.ts`, `dossier-targets.ts` or `ladder.ts`.
- Weekly points target ramps 60, 75, 90, 105, 120 and is halved for a casual searcher (`pointsNeededForA`, `CASUAL_PACE = 0.5` in `src/lib/weekly/action-effort.ts`). Casual comes from `searchIntensity` in CASUALLY_LOOKING, EXPLORING or OPEN, or difficulty level 1 (`src/lib/scoring/search-intensity.ts`). Employed searching journeys get it from the "When do you want to start applying?" answer: Now = actively, 1 to 3 months = casual, 3 to 6 months or just curious = exploring (casual) (`intensityFromTiming`). Unemployed searching journeys are asked directly. **The four not-searching journeys are never asked, so `searchIntensity` stays null and they get pace 1.** Not found: any journey check in `pace.ts`, `action-effort.ts` or `weekly-engines.ts`.
- Confidential Search Mode default is set at onboarding as `journey.confidentialByDefault || defaultConfidentialSearchMode(jobStatus)` (`updateSituation`). The second term returns true for EMPLOYED_CONSIDERING_MOVE, RESIGNED and SEEKING_PROMOTION (`src/lib/confidential-mode.ts`). EXPLORING_MOVE, GROWING, FRACTIONAL, NEXT_ACT and ENTREPRENEUR all write EMPLOYED_CONSIDERING_MOVE, so **all five are ON in practice**, even though `journey.ts` says false for NEXT_ACT and FRACTIONAL. While ON: supporters cannot be invited (https://launchyournextchapter.com/dashboard/supporters says so), the recruiter opt-in asks to turn it off first (`HomeRecruiterGoalSection`), the Candidate+ mark is hidden until shown, and community, references and leaderboard behave privately (about 50 files read `confidentialSearchMode`, e.g. `src/app/dashboard/community/page.tsx`; I did not read each one).

### Home (https://launchyournextchapter.com/dashboard)

- Headline is `getJourney(j).goal`, tailored for all 11. Under it, a pill with the stage and "Not quite right? Change".
- **One note at a time** (`src/app/dashboard/page.tsx`): coaching form, stalled search, passive-to-active (only in Confidential mode), got hired (any member from week 2 until they claim), search playbook, else the culture survey. Only the **search playbook** is journey-specific, and only for LAID_OFF, EXPLORING_MOVE, PROMOTION, CAREER_CHANGE, STUDENT_NEW_GRAD, RETURNING and NEXT_ACT, and only in APPLYING, INTERVIEWING or OFFER (`searchClock`, `loadSearchPlaybook`). GROWING, ENTREPRENEUR, FRACTIONAL and TIME_OFF have no playbook (`PLAYBOOKS`).
- The **daily message** is an admin-written rotation per page (`src/lib/dashboard/page-content.ts`); journey segmentation not found. Pre-connect and Search Strategy messages override it for everyone.
- Weekly plan card: `shapePlan` in `src/lib/journey/plan.ts` puts the engagement items (top personalization question, gate moves, red-flag and AI items, culture items, return-date and fractional items, a pending career conversation) first, then the journey's own steps, then the general task menu. Titled "Your weekly plan" for the four not-searching journeys.
- Also shown to every member: Jobs tile (Saved, Applied, Interviews), Network tile, Candidate+ unlock ladder (after the Search Strategy gate), first-week card (`src/lib/onboarding/first-week.ts`, same 7 steps for all).

### Emails

- Saturday "Has anything changed?" at the stage pace (`runSearchCheckin`, `checkInDue`); email has three fixed buttons (still searching, managing my career, got an offer). Win-back at 21, 42, 63 days quiet with a one-line suggestion per journey (`src/lib/winback/sequence.ts`); TIME_OFF is skipped. Job Search Daily and fresh job alerts skip STAYING and LANDED (`notLookingNow`). Daily nudge, midweek check-in and Friday gap nudge filter only on `NOT_CASUAL_WHERE` (searchIntensity null or active): no stage or journey filter found in `run-daily-nudge.ts`, `run-midweek-checkin.ts`, `run-gap-nudge.ts` or their senders. `stage-guide.ts` lists the Friday nudge only under Applying. The search check-in, Friday gap nudge and weekly-goal emails carry the shared "Get more from NextChapter" block (`src/emails/engagement-block.tsx`); engagement steps stop at personalization questions for TIME_OFF and ENTREPRENEUR (`unlockSteps`).
- In-work review emails (prepare 21 days before, respond 5 to 7 days after a review window): journeys PROMOTION, EXPLORING_MOVE, NEXT_ACT only (`src/app/api/cron/in-work-review-emails/route.ts`, flag `IN_WORK_REVIEW_EMAILS_ENABLED`).

### Jobs shown

- Board work types default (`defaultWorkTypes`, `src/lib/jobs/work-type.ts`): full-time for everyone; NEXT_ACT gets part-time, contract and advisory only (no full-time); part-time and contract are added if the member answered interim or fractional interest, or has a flexible parallel path; advisory is added if `boardAdvisoryWillingness`. Internships never appear on the member board (owner's rule, in the file header). The career window is own stage, one up, one down, plus one more down if `isPivoting` (`src/lib/jobs/career-stage.ts`).
- Early career members (STUDENT_NEW_GRAD or under 5 years) lose the independent-work toolkit, board and advisory, and executive upsells (`featureVisible` in `src/lib/early-career/audience.ts`).

### Personalization spine (`src/lib/personalization/spine.ts`)

Per journey and stage it lists which questions drive the plan, learning, networking, opportunities, report and coaching. Used for the "answer one question" step on Home and in emails. Journeys: SEARCHING = LAID_OFF, EXPLORING_MOVE, PROMOTION, CAREER_CHANGE, STUDENT_NEW_GRAD, RETURNING, NEXT_ACT; NOT_SEARCHING = GROWING, ENTREPRENEUR, FRACTIONAL, TIME_OFF. For the not-searching four only these signals apply: level, function, years, network comfort, coaching style, plus the journey-specific one (GROWING current pay; ENTREPRENEUR current pay; FRACTIONAL offering, open days, engagement end, skills; TIME_OFF return date).

### Stages the plan engine handles per journey (`journeyPlanItems`)

In STAYING, GROWING/ENTREPRENEUR/FRACTIONAL/TIME_OFF each use their own plan and every other journey uses the GROWING plan. In APPLYING, INTERVIEWING, OFFER and EXPLORING/PREPARING, the journey's own plan is used. **A "I'm ready to start applying" answer changes only the stage, never the journey** (`changeForAnswer`). So a GROWING, FRACTIONAL, ENTREPRENEUR or TIME_OFF member who says "ready" lands in APPLYING with the journey plan of their old situation (review prep, renewals, venture check-ins, return date) and no playbook, because those journeys have no search plan. No code path found that switches the journey on "ready".

---

## 1. LAID_OFF: "Laid off or let go"

**(a) Entry and stages.** Cards `just_laid_off` and `just_resigned`; `just_resigned` keeps `currentJobStatus` RESIGNED, which also turns Confidential Search Mode on. Outplacement seat; "I was laid off" in any check-in; a college report; legacy LAID_OFF/RESIGNED. Default stage APPLYING. "When do you want to start looking?" (`startTiming`) sets APPLYING (right away), PREPARING (a few weeks) or EXPLORING (after some time off). Natural stages: all of EXPLORING to LANDED.

**(b) Collected.** `gapDuration` (how long searching, required), `searchIntensity` (required), `workingNow`, `aiDisplacementReason` (optional), applications and interviews so far or "just started", `networkComfortLevel`, `coachingStylePreference`, culture fit, remote and relocation. `journeyDetails`: `startTiming`, `workingNow`. `lastJobEndedAt` (last day worked) drives the search clock and the unemployment weeks left, but is only asked on https://launchyournextchapter.com/dashboard/got-hired (`saveLastJobEndedAt` in `HireOutcomeForm`). Screening answers (restrictive covenant, fired for cause, drug test, background check) at https://launchyournextchapter.com/dashboard/profile/screening feed red-flag plan items. Not found at onboarding: severance, benefits end date, last day worked.

**(c) What the system does.**
- Menu: ACTIVE, everything open. If they chose to start later: EXPLORING or PREPARING locks.
- Plan: first week is "File for unemployment benefits", "Review your severance and benefits dates", tell 10 people, list 20 target companies, book a coaching session; then 5 more people a week. Stalled-search gates at weeks 3, 6, 9, 13 (half pace if casual) and result-aware moves (no interviews, no offers). Plan items for an AI-displaced member.
- Search playbook (the only journey with SINCE_LAST_JOB basis): weeks 4, 12, 20, 27 ("not a personal failure" only for LAID_OFF), 40, each with a cited statistic.
- Home note: playbook; benefits and runway card on the Benefits page; guides "unemployed", "72-hours", COBRA and bridge income are keyed to the legacy LAID_OFF status.
- Tone: Market Reality framing "optimize for the right role, fast; be direct". Coaching style sets the wording of unlock and stalled messages.
- Candidate+: global targets. Effort pace: 1 if actively, 0.5 if casual.
- Confidential: OFF (ON for RESIGNED). Colleges are told (transition flag) when someone becomes LAID_OFF.
- Jobs: full-time board, quick link to independent work at week 20. Emails: everything, plus Job Search Daily.

**(d) Features that matter, where they live.**
- Find a job: https://launchyournextchapter.com/dashboard/find-my-job
- Benefits and runway (unemployment by state, savings cushion, COBRA, severance): https://launchyournextchapter.com/dashboard/benefits
- Local market (layoffs, hiring near them): https://launchyournextchapter.com/dashboard/local-market
- Network and contacts: https://launchyournextchapter.com/dashboard/network and https://launchyournextchapter.com/dashboard/network/contacts
- Interview prep: https://launchyournextchapter.com/dashboard/interview-prep
- Coaching: https://launchyournextchapter.com/dashboard/my-coaching
- Support during transition: https://launchyournextchapter.com/dashboard/support
- Got an offer: https://launchyournextchapter.com/dashboard/got-hired

**(e) Gaps.**
- Last day worked is not asked at onboarding, so the SINCE_LAST_JOB clock and "weeks of benefits left" fall back to "since search started" or nothing for most members.
- No severance or COBRA deadline tracker; benefits dates are text in the plan and a pressure form on the Benefits page (`BenefitsPressureForm`).
- "Resigned" is only a confidential flag; no resignation-specific plan (notice, garden leave, references).
- The "Was AI part of why your last role ended" answer yields one plan item (`aiOutlookItems`); no AI-resilience role map beyond that.
- Irrelevant: none significant. Best served journey.

---

## 2. EXPLORING_MOVE: "Thinking about a move"

**(a) Entry and stages.** Cards `ready_to_move` and `worried_let_go` (same journey; the card is not stored). Default stage EXPLORING. "When do you want to start applying?": Now = APPLYING, 1 to 3 months = PREPARING, 3 to 6 months or just curious = EXPLORING. Natural stages: EXPLORING, PREPARING, APPLYING, INTERVIEWING, OFFER, LANDED.

**(b) Collected.** `journeyDetails.applyTiming`, `journeyDetails.moveDriver` (keeping options open, ready to leave, worried about a layoff; optional), derived `searchIntensity`, culture fit, `lastSalary` (profile, for pay comparison), remote and relocation, network comfort, coaching style.

**(c) What the system does.**
- Menu: EXPLORING (Find a job, Interview Prep, Got an Offer, Recruiter locked), PREPARING or ACTIVE as the stage moves. In-work workspace and review emails: yes.
- Plan while exploring: compare pay, refresh LinkedIn quietly, track 10 companies; then a coffee chat a month and one skill gap. Once PREPARING or APPLYING: the quiet search plan (refresh résumé, quiet company list, two references, one quiet conversation). Driver items: "unhappy" adds a what-you-want step; "layoff worry" adds runway, state unemployment benefits and keep-ready steps.
- Search playbook (active stages only): weeks 4, 8, 12, 20 (go through people, read your funnel, widen or sharpen, decide whether to keep going).
- Home note: playbook only in active stages; otherwise generic notes.
- Tone: report framing "employed, thinking about a move, not applying yet. Do not push application volume"; QUIET_SEARCH framing once preparing; driver adds honesty or runway language.
- Candidate+: global; pace casual in 3 of 4 timing answers.
- Confidential: ON. Search stage label QUIETLY_LOOKING. Guide "Before you go" (keyed to EMPLOYED_CONSIDERING_MOVE).
- Jobs: full-time. Emails: Job Search Daily yes (stage not STAYING); daily, midweek and Friday emails only when active.

**(d) Features.**
- Market and Market Reality: https://launchyournextchapter.com/dashboard/market and https://launchyournextchapter.com/dashboard/market-reality
- Know your worth: https://launchyournextchapter.com/dashboard/pay
- Companies: https://launchyournextchapter.com/dashboard/companies
- Network (quiet): https://launchyournextchapter.com/dashboard/network
- Privacy and Confidential mode: https://launchyournextchapter.com/dashboard/privacy
- Reviews and raises (to test the case for staying): https://launchyournextchapter.com/dashboard/in-work
- Benefits and runway (layoff worry): https://launchyournextchapter.com/dashboard/benefits

**(e) Gaps.**
- No "stay or go" comparison (current role vs market vs an offer); Know your worth and the in-work workspace are separate pages.
- Persona choice "worried about being let go" is lost after the card (only the journey is stored), so the member is asked again.
- Find a job is locked while exploring, which is the stage most of these members start in, although they browse quietly.
- Runway: the savings cushion lives only on the Benefits page and assumes unemployment (`RunwayCard` takes `weeksSinceLastJob`); no what-if for "if I left now".
- Supporters blocked by Confidential mode, which defaults ON here.

---

## 3. GROWING: "Managing my career"

**(a) Entry and stages.** Card `growing_in_job`; check-in answer "I'm back at work after a break"; 90 days after LANDED (automatic); growth and learning seats. Default and natural stage STAYING. Other stages are valid, but "ready" keeps the GROWING plan (see shared mechanics).

**(b) Collected.** No search questions (`searching: false`). Common profile fields only; `lastSalary` for pay position. No journeyDetails keys. The spine asks level, function, years, current pay, skills assessment, network comfort, coaching style.

**(c) What the system does.**
- Menu: STAYING. The "Manage your career" pillar comes first (Know your worth, Build your case, Prove your results, Build new skills, Practice the hard conversation, Know how you work). Find a job, Interview Prep, Offer are locked; Recruiter, Interim, EQoverIQ, Benefits hidden.
- Plan: wins from the last six months, prepare for the next performance review, benchmark pay, name a recession-proof skill; then plan the manager conversation, skill course, keep résumé, references, network current, sponsor or mentor meeting. Pending career conversations appear as a plan item.
- Search playbook: none. Home note: generic (no journey-specific note found). Weekly plan card titled "Your weekly plan".
- Tone: report framing is review, raise, promotion case, pay vs market, skills that keep value, recession-proofing.
- Candidate+: global (5 applications, 480 minutes). Pace 1.
- Confidential: ON. No job-listing emails (STAYING). Win-back suggestion: write one win.
- Jobs: not shown by design (tab locked).

**(d) Features.**
- Build your case: https://launchyournextchapter.com/dashboard/review-prep
- Reviews, raises and promotion workspace (wins, prep checklist, salary, feedback, outcome): https://launchyournextchapter.com/dashboard/in-work
- Know your worth: https://launchyournextchapter.com/dashboard/pay
- Learn new skills: https://launchyournextchapter.com/dashboard/learning
- How I perform / strengths: https://launchyournextchapter.com/dashboard/how-i-perform and https://launchyournextchapter.com/dashboard/strengths
- References and Dossier: https://launchyournextchapter.com/dashboard/references and https://launchyournextchapter.com/dashboard/portfolio
- Pivot paths (as an exit option): https://launchyournextchapter.com/dashboard/pivot-paths

**(e) Gaps.**
- **The Reviews and raises tab is hidden for GROWING** (`isInWorkMember` = PROMOTION, EXPLORING_MOVE, NEXT_ACT) and the cron skips them; the workspace page greets them with "built for people who have a job and want to grow in it. You can use it anyway".
- Several grow items have no tab of their own (Know your worth, Prove your results, Know how you work are folded into other pages); the redesign needs a clear home for each.
- Candidate+ asks for 5 applications from someone not applying; the Home recruiter-goal card appears but recruiters are hidden in this mode.
- Confidential ON blocks supporters, though these members usually have nothing to hide.
- Friday gap nudge and daily nudge are not filtered by stage (see shared mechanics).
- Same Search Strategy hard gate (target role, company size, blockers) as a job seeker.

---

## 4. PROMOTION: "Going for a promotion"

**(a) Entry and stages.** Card `looking_for_promotion`; legacy SEEKING_PROMOTION. Default stage PREPARING, shown with the STAYING menu. "When do you want to start applying?": Now = APPLYING, 1 to 3 months or 3 to 6 months = PREPARING, just curious = EXPLORING (the last two both use the STAYING menu).

**(b) Collected.** `applyTiming`, derived `searchIntensity`, `lastSalary`, culture fit, common fields. In-work tables (private): wins, review cadence and dates, prep, salary, promotion gap checklist, feedback, outcomes (`InWork*` models; constants in `src/lib/in-work/constants.ts`).

**(c) What the system does.**
- Menu: STAYING while EXPLORING or PREPARING (`menuMode` special case), ACTIVE once applying.
- Plan: three wins this quarter, name the gap, benchmark next-level pay; then the manager conversation, a sponsor meeting, one gap closed. For 2 to 5 years in, early career steps are added.
- Search playbook (active stages only): weeks 4, 8, 12, 20 (build the case, know your number, make the ask, test the market with two outside interviews).
- Home note: playbook only in active stages.
- Tone: report framing is the gap to the next level and the leverage that wins it.
- Candidate+: global. Confidential: ON by job status SEEKING_PROMOTION. In-work review emails: yes.
- Jobs: full-time, but Find a job is locked in the STAYING menu until they apply elsewhere.

**(d) Features.**
- Build your case: https://launchyournextchapter.com/dashboard/review-prep
- Reviews and raises workspace: https://launchyournextchapter.com/dashboard/in-work
- Know your worth: https://launchyournextchapter.com/dashboard/pay
- Network (sponsors, mentors): https://launchyournextchapter.com/dashboard/network
- Practice the conversation (Interview prep tab): https://launchyournextchapter.com/dashboard/interview-prep
- Early career plan, 2 to 5 years in: https://launchyournextchapter.com/dashboard/early-career

**(e) Gaps.**
- Two parallel promotion tools (Build your case and the in-work workspace) that cross-link but do not share data; a "next-level gap" checklist exists in the workspace but not as a skills map.
- No peer-level benchmark of the next level's title and pay beyond the generic pay page.
- Find a job is locked until "ready", so the outside-offer leverage step (playbook week 20) points to a locked page.
- Same applications requirement for Candidate+.

---

## 5. CAREER_CHANGE: "Changing careers"

**(a) Entry and stages.** Card `career_pivot`; legacy CAREER_PIVOT. Default stage EXPLORING; timing answers as for EXPLORING_MOVE except 1 to 3 months and 3 to 6 months both give EXPLORING (only EXPLORING_MOVE and PROMOTION use PREPARING for timing). Natural stages: EXPLORING, PREPARING, APPLYING, INTERVIEWING, OFFER, LANDED.

**(b) Collected.** `applyTiming`, derived `searchIntensity`, common fields. **Not collected at onboarding:** target function or field. `targetFunction` is asked on https://launchyournextchapter.com/dashboard/search-strategy only after ticking the `isPivoting` checkbox ("I'm considering a career pivot..."). Choosing the CAREER_CHANGE journey does not set `isPivoting` (no write found in `apply.ts` or `onboarding/actions.ts`; the only writer is `search-strategy/actions.ts`).

**(c) What the system does.**
- Menu: EXPLORING, then PREPARING, ACTIVE. In-work workspace: not included.
- Plan: map your transferable skills (plain text, no link), pick three target roles in the new field, an informational call; ongoing calls and a bridge course or certificate.
- Search playbook (active stages only): weeks 4, 12, 20, 30 (name target and gap, produce proof and talk to ten people, test a bridge role via the independent-work link, review the pivot).
- Learn: https://launchyournextchapter.com/dashboard/learning shows a function and occupation trends card when the journey is CAREER_CHANGE or `isPivoting`.
- Tone: report framing judges them against the target field and names bridge steps.
- Candidate+: global. Confidential: ON. Gmail and LinkedIn reasons say "find people already working in the field".
- Jobs: matching uses `targetFunction ?? (isPivoting ? null : primaryFunction)` (`src/lib/jobs/job-match.ts` line 610). Without the checkbox, jobs rank against the current function. The career window adds one more stage down only when `isPivoting`.

**(d) Features.**
- Pivot paths (where skills carry over, local demand, pay, training; O*NET and BLS): https://launchyournextchapter.com/dashboard/pivot-paths
- Skills matrix: https://launchyournextchapter.com/dashboard/skills-assessment and assessments https://launchyournextchapter.com/dashboard/skills-assessments
- Learn: https://launchyournextchapter.com/dashboard/learning
- Network: https://launchyournextchapter.com/dashboard/network
- Find a job (bridge, contract): https://launchyournextchapter.com/dashboard/find-my-job?types=part_time,contract,advisory
- Search strategy (target function): https://launchyournextchapter.com/dashboard/search-strategy

**(e) Gaps.**
- Journey is not connected to `isPivoting` or `targetFunction`, so job fit, the board window, the Pivot paths teaser (prominent only when `isPivoting`) and the spine's `target_function` question all depend on a checkbox deep in Search Strategy.
- "Map your transferable skills" has no tool behind the plan item; the pieces exist (skills matrix, Pivot paths skills layer) but are not linked from it.
- No guided exploration flow for someone who does not yet know the target: Pivot paths needs a current occupation first and shows "Tell us what you do now" if none.
- No bridge-credential or pay-step-down planner tied to the journey (playbook text only).
- Find a job locked while exploring, but bridge roles are the playbook week-20 step.

---

## 6. STUDENT_NEW_GRAD: "Student or recent grad"

**(a) Entry and stages.** Card `just_graduated`; the confirm step's "Where are you in your career?" (student or new grad, early career, experienced) sets years and the early-career audience (NEW_GRAD under 2 years, EARLY_CAREER 2 to 5). Default stage PREPARING. Natural: PREPARING, APPLYING, INTERVIEWING, OFFER, LANDED, then STAYING (as GROWING).

**(b) Collected.** `careerStage` choice and derived years, school, degree, major and class year (`saveMemberEducation`, in onboarding when given, else on the early career plan), `gapDuration` (asked as "How long have you been searching?"), `searchIntensity`, `workingNow`, plus the AI-displacement question (shown but irrelevant), common fields.

**(c) What the system does.**
- Menu: PREPARING. Early career plan tab appears; the independent-work toolkit, board and advisory and executive upsells are hidden (`featureVisible`).
- Plan: first résumé from internships and coursework, pick two or three target roles from the major, LinkedIn, 10 employers, an alumni call; ongoing mock interview, behavioral practice, alumni informational interviews, one free course. The NEW_GRAD audience adds the same alumni and behavioral steps. OFFER stage gives first-salary framing.
- Search playbook (active stages only): weeks 2, 4, 8, 12, 20 (aim, talk to alumni, practice, widen the door, keep a skill moving).
- Home: "Your first job plan: N of 10 done" module (`EarlyCareerHomeModule`) from the first-job checklist.
- Tone: report framing "lack of experience is normal, not a weakness".
- Candidate+: global. Confidential: OFF.
- Jobs: entry-level window. Internships are never on the member board; the playbook says they are listed in the member's college portal. Job emails exclude early-career jobs unless `EARLY_CAREER_IN_EMAILS` is `true` (`earlyCareerInEmails`; the flag value in production was not verified).

**(d) Features.**
- Early career plan (checklist, school, major to roles with O*NET skills, starting pay, grad school guide): https://launchyournextchapter.com/dashboard/early-career
- Find a job (entry level): https://launchyournextchapter.com/dashboard/find-my-job
- Groups and alumni jobs: https://launchyournextchapter.com/dashboard/groups and https://launchyournextchapter.com/dashboard/alumni-jobs
- Interview prep: https://launchyournextchapter.com/dashboard/interview-prep
- Résumé and LinkedIn: https://launchyournextchapter.com/dashboard/resume and https://launchyournextchapter.com/dashboard/linkedin
- Companies: https://launchyournextchapter.com/dashboard/companies

**(e) Gaps.**
- Internships: no path for a student who did not join a college portal.
- "A strong first year" (the stated goal) has no dedicated feature after landing; LANDED and the 90-day move into GROWING use the generic first-90-days plan.
- No class-year or graduation-date timeline (campus recruiting windows are mentioned in the playbook only).
- Candidate+ asks for 5 applications, 5 outreach and 480 minutes with no student scaling.
- Irrelevant questions: "Was AI part of why your last role ended?" and "How long have you been out of work or searching" are shown in onboarding to students; Pivot paths opens with a current-occupation prompt.

---

## 7. RETURNING: "Returning after a break"

**(a) Entry and stages.** Card `reentering_workforce` (legacy CAREGIVER_LEAVE_SABBATICAL and RELOCATED_FOR_FAMILY map here). Default stage PREPARING. Natural: PREPARING to LANDED.

**(b) Collected.** `gapDuration`, `searchIntensity`, `workingNow`, applications and interviews so far, AI-displacement question, culture fit, common fields. Departure reasons CAREGIVER_LEAVE and SABBATICAL can be tagged on work history and are treated sympathetically by résumé analysis (`src/lib/resume/analyze-resume.ts`). Not collected: reason for the break, its length in years, skills used during it.

**(c) What the system does.**
- Menu: PREPARING. Plan: write a two-sentence story for the break (plain text), refresh one skill, look at interim or part-time work; then a mentor or former-colleague call.
- Search playbook (active stages only): weeks 4, 8, 12, 20 (tell the gap in two sentences and reconnect five colleagues, refresh and prove with a Dossier project, aim at returnship employers, widen with part-time or fractional).
- Return-to-work platforms (Mom Project, Path Forward, iRelaunch, FlexJobs, PowerToFly, Fairygodboss, RetirementJobs/Encore) are in the platform directory (`src/lib/platforms/directory.ts`, category RETURN_TO_WORK) and show in the independent-work toolkit only when part-time or contract types are switched on.
- Tone: report treats the gap as context, not a flaw. Candidate+: global. Confidential: OFF.
- Jobs: full-time default; part-time and contract only after interest is expressed.

**(d) Features.**
- Find a job: https://launchyournextchapter.com/dashboard/find-my-job (independent-work toolkit: https://launchyournextchapter.com/dashboard/find-my-job?types=part_time,contract,advisory#independent-work)
- Learn: https://launchyournextchapter.com/dashboard/learning
- Portfolio and Dossier: https://launchyournextchapter.com/dashboard/portfolio
- Work history and résumé: https://launchyournextchapter.com/dashboard/resume
- Network: https://launchyournextchapter.com/dashboard/network
- Benefits: https://launchyournextchapter.com/dashboard/benefits

**(e) Gaps.**
- No return-to-work plan: no returnship program listing (the playbook says only that such programs exist), no gap-story builder, no "skills that changed while I was away" map. Not found in `src/` beyond the items above.
- The break story is a plan sentence with no link or tool.
- Part-time and contract roles, the natural first step back, are off by default.
- Irrelevant: AI-displacement question for someone who left voluntarily.

---

## 8. NEXT_ACT: "Planning the next act"

**(a) Entry and stages.** Card `next_act`. Default stage EXPLORING. "When do you want to start applying?" as for CAREER_CHANGE. Natural: EXPLORING to LANDED, then STAYING.

**(b) Collected.** `applyTiming`, derived `searchIntensity`, `boardAdvisoryWillingness` (Search Strategy and a second ask on the board page), `interimConsultingInterest`, `gigDirectoryUnlockAnswer`, independent-work experience (consulting, expert network, fractional, part-time: now, past, never) with email pre-fill (`src/lib/independent-work/experience.ts`), common fields. No age or retirement field found; board readiness is by level and years only (`src/lib/interim-work/board-readiness.ts`: C-Suite 10+ years, VP 15+, Director 20+, or level rank score).

**(c) What the system does.**
- Menu: EXPLORING (so Find a job is locked), PREPARING, ACTIVE.
- Plan: draft a board and advisory profile (plain text), list 10 organizations, look at fractional and interim roles; then two conversations about board or fractional work.
- Search playbook (active stages only): weeks 8, 16, 24 (define the offer, have ten conversations, land a first engagement).
- Jobs: default board is part-time, contract and advisory only, no full-time (`defaultWorkTypes`). Board directories and "board ready" vs nonprofit-board listings, fractional marketplaces, expert networks, launch plan on the board page.
- Tone: report judges against advisory and fractional roles, not ladder jobs. Gmail reason mentions board and fractional conversations.
- Candidate+: global. Confidential: ON in practice (job status), OFF in `journey.ts`.

**(d) Features.**
- Independent-work toolkit: https://launchyournextchapter.com/dashboard/find-my-job?types=part_time,contract,advisory#independent-work
- Platforms and activity (from Gmail): https://launchyournextchapter.com/dashboard/platforms
- Portfolio / positioning: https://launchyournextchapter.com/dashboard/portfolio
- Network: https://launchyournextchapter.com/dashboard/network
- Reviews and raises workspace (shown, since NEXT_ACT is an in-work journey): https://launchyournextchapter.com/dashboard/in-work
- Recruiters: https://launchyournextchapter.com/dashboard/recruiter-requests

**(e) Gaps.**
- The main page for this work, Find a job, is locked in EXPLORING, the default stage.
- Confidential ON by default defeats positioning (Candidate+ mark hidden, recruiters and supporters off) for someone who needs to be found.
- No age-aware or experience-aware content for board and advisory at 55+ (no age field, no encore-career path); "board ready" is a level and years heuristic marked as first pass in the file.
- No pipeline (conversations, proposals, engagements) beyond the launch-plan tracker and platform activity.
- The In-work workspace is shown to NEXT_ACT, although it assumes a job with reviews.
- Plan steps "Draft your board and advisory profile" and "Look at fractional and interim roles" are text with only one linked action (`INTERIM_PROFILE_CREATED`).

---

## 9. TIME_OFF: "Taking a break"

**(a) Entry and stages.** Card `taking_a_break` (job status CAREGIVER_LEAVE_SABBATICAL). Default and natural stage STAYING (mode LEAVE). A "ready" answer moves only the stage.

**(b) Collected.** `journeyDetails.returnDate` (optional). Nothing else journey-specific: no reason for leave, no paid or unpaid, no benefits end date. No search questions. The spine asks level, function, years, network comfort, coaching style and return date.

**(c) What the system does.**
- Menu: LEAVE. Find a job, Interview prep, Offer locked ("Job tools are off while you are on a break"); Recruiter, Interim, EQoverIQ hidden; Benefits shown; unlock box offers "I'm back at work" (to GROWING) and "ready to start applying".
- Plan: set the return date, check leave, pay and benefits dates, write what you want from work when back; ongoing one warm relationship a month and optional learning. From 42 days before the return date, a plan item counts down.
- Check-in: asked a week before the return date (`checkInDue`). No Job Search Daily (STAYING); no win-back (skipped); unlock steps limited to personalization questions.
- Tone: report "no urgency and no application pressure".
- Candidate+: global. Confidential: OFF.
- No search playbook. Pace 1 (searchIntensity null).

**(d) Features.**
- Return plan on Home: https://launchyournextchapter.com/dashboard
- Situation / return date: https://launchyournextchapter.com/dashboard/privacy
- Benefits: https://launchyournextchapter.com/dashboard/benefits
- Network (light): https://launchyournextchapter.com/dashboard/network
- Learn: https://launchyournextchapter.com/dashboard/learning
- Support: https://launchyournextchapter.com/dashboard/support

**(e) Gaps.**
- Thinnest data of any journey (one date). No what-if for finances while away or a "pause" model (income, benefits, health coverage) beyond the unemployment runway card, which assumes a prior layoff.
- Required Search Strategy gate and the seven-step first week (day 2 "Save your first job") apply to a person who is not looking.
- Candidate+ rule (5 applications), full weekly points target, and the daily, midweek and Friday emails are not stage-filtered, so a member on leave can get progress nudges.
- The spine says "we ask how you are doing as the date nears"; the code asks "Has anything changed?" (job status), not how they are doing.
- No return-readiness help: skills refresh, résumé update and re-entry conversations are single plan lines.
- A member on leave with no return date is treated as STAYING with a monthly check-in.

---

## 10. FRACTIONAL: "Happy with fractional work"

**(a) Entry and stages.** Card `happy_fractional`; check-in answer "I'm doing fractional work and I'm happy" (email and Privacy; not in the in-app pop-up). Default and natural stage STAYING (mode PORTFOLIO). "Ready" or "laid off" opens a search.

**(b) Collected.** `journeyDetails.offering` (one line), `openDays` (0 to 5), `engagementEnds` (date); current engagement end also read from work history (`engagementType` FRACTIONAL or INTERIM with `expectedEndDate`). Common fields; skills assessment in the spine. Not collected: rate, number or names of clients, pipeline stage, industry focus.

**(c) What the system does.**
- Menu: PORTFOLIO. "Work now" pillar first (Find Interim Work, EQoverIQ shown); Find a Full-time Job and Got An Offer locked; Recruiter hidden; Benefits shown. Unlock box offers "ready to apply" and "I lost my main client or role".
- Plan: list engagements and end dates, write the one-line offer, check the rate, ask a client for a referral or testimonial; then start renewal 30 days before an engagement ends, two conversations with potential clients, one post. Journey-detail items: engagement ends in 45 days or less, open days, use your one-line offer.
- No playbook. Tone: report judges positioning, rate, pipeline, renewals against fractional demand.
- Candidate+: global. Confidential: ON in practice, OFF in `journey.ts`. No Job Search Daily (STAYING).
- Jobs: default board is full-time plus whatever interest they have answered; part-time, contract and advisory not preset for this journey.

**(d) Features.**
- Independent-work toolkit (marketplaces, expert networks, launch plan, platform activity): https://launchyournextchapter.com/dashboard/find-my-job?types=part_time,contract,advisory#independent-work
- Platforms: https://launchyournextchapter.com/dashboard/platforms
- References for testimonials: https://launchyournextchapter.com/dashboard/references
- Portfolio and work samples: https://launchyournextchapter.com/dashboard/portfolio and https://launchyournextchapter.com/dashboard/work-samples
- LinkedIn and marketing plan: https://launchyournextchapter.com/dashboard/marketing-plan
- Know your worth (rate): https://launchyournextchapter.com/dashboard/pay

**(e) Gaps.**
- The journey's door (Find a job) is a locked tab in PORTFOLIO mode, and the default work types do not include contract, part-time or advisory for FRACTIONAL.
- No pipeline or CRM for clients and engagements (stage, value, renewal date); only three `journeyDetails` keys and plan text.
- No rate benchmark for fractional work: `payComparison` explicitly skips part-time, contract and advisory.
- Candidate+ and "recruiters see you" are built for hiring managers, not for clients; Confidential ON by default hides the mark.
- Pace 1 and the standard progress emails apply to someone who is happy.

---

## 11. ENTREPRENEUR: "Building something of my own"

**(a) Entry and stages.** Card `building_something`. Default and natural stage STAYING (mode STAYING). Check-in "managing" keeps the journey.

**(b) Collected.** Nothing journey-specific. No journeyDetails keys. The plan asks "Tell us what you are building and where it stands" and "Note what you need from your career while you build", but there is no field or page that stores either (not found). The spine covers level, function, years, current pay, network comfort, coaching style.

**(c) What the system does.**
- Menu: STAYING (same as GROWING): Find a job locked; Interim, EQoverIQ and Benefits hidden.
- Plan: first week is two text prompts; ongoing: monthly check-in on the venture and one door-open conversation. Engagement steps stop at personalization questions. No playbook.
- Tone: report "do not frame a job search... keep it short". Win-back asks for one thing learned this month.
- Candidate+: global. Confidential: ON. No Job Search Daily (STAYING).
- Jobs: not shown by design.

**(d) Features.**
- Home plan: https://launchyournextchapter.com/dashboard
- Network: https://launchyournextchapter.com/dashboard/network
- Know your worth: https://launchyournextchapter.com/dashboard/pay
- Learn: https://launchyournextchapter.com/dashboard/learning
- Benefits is hidden in STAYING mode, though its page is at https://launchyournextchapter.com/dashboard/benefits
- The college portal has a "Build on the side" path for this journey (`LEARNING_PATHS` in `src/lib/higher-ed/community.ts`); nothing like it on the candidate site.

**(e) Gaps.**
- No venture data, no runway (income, health coverage, "way back") tool, no investor or customer network, no skills or learning path.
- Both first-week plan items have nowhere to be answered.
- Same hard gate, first-week card and Candidate+ as a job seeker; progress emails not stage-filtered.
- The only value is a monthly "keep your options open" check-in, with no way back that is more than text (a "ready" answer keeps the ENTREPRENEUR plan).

---

## Cross-cutting findings (with the file to look at)

1. **Not-searching journeys get search defaults.** `getHardGateStatus` / `isSearchGoalsComplete` / `isBlockersAndMotivationsComplete` (`src/lib/dashboard/access-gate.ts`, `src/lib/search-strategy.ts`) require target role, industries, company size and stage, blockers and motivations from every new member. `FIRST_WEEK` (`src/lib/onboarding/first-week.ts`) is journey-blind. `candidatePlusRequirements` has no journey input. Daily nudge, midweek and Friday gap emails have no stage filter. `showGotHiredCTA` in `src/app/dashboard/page.tsx` has no journey check.
2. **Status answer "ready to start applying" never changes the journey.** `changeForAnswer` in `src/lib/journey/journey.ts`; consequence described in shared mechanics.
3. **Confidential default mismatch.** `confidentialByDefault` in `journey.ts` (NEXT_ACT and FRACTIONAL false) vs `defaultConfidentialSearchMode(jobStatus)` (true for EMPLOYED_CONSIDERING_MOVE) in `updateSituation`.
4. **Guides are keyed on legacy `currentJobStatus`** (`src/lib/constants/guides.ts`, `GuideCallout`). EXPLORING_MOVE, GROWING, NEXT_ACT, FRACTIONAL and ENTREPRENEUR all collapse to EMPLOYED_CONSIDERING_MOVE, and TIME_OFF and RETURNING both collapse to CAREGIVER_LEAVE_SABBATICAL, so they cannot be told apart there.
5. **In-work membership** (`IN_WORK_JOURNEYS`) excludes GROWING and CAREER_CHANGE, includes NEXT_ACT.
6. **Learn** (`src/lib/learning/build-learning-plan.ts`) reads function, target role, industries, skill gaps and assessment; no journey input found. Only the trends card checks CAREER_CHANGE.
7. **Daily message** (admin-authored rotation) is not segmented by journey (`src/lib/dashboard/page-content.ts`).
8. **Mood check-in and Support page** (`src/lib/daily/mood-labels.ts`: Stuck, Getting there, Moving, Fired up; https://launchyournextchapter.com/dashboard/support copy "Losing a job — or leaving one...") are not journey-specific. The Support copy fits LAID_OFF and a little RETURNING; it does not address leave, a venture, or a promotion that stalled.
9. **Supporters** (https://launchyournextchapter.com/dashboard/supporters) are blocked in Confidential mode, which is the default for 5 journeys; the weekly note is about search effort.
10. **Doc drift:** `docs/CANDIDATE_JOURNEYS_AND_FEATURES.md` listed 8 journeys (fixed 2026-10-20, it now lists all 11), and `docs/CANDIDATE_MENU.md` shows "Reviews and raises" as shown to everyone; the code shows it only for PROMOTION, EXPLORING_MOVE and NEXT_ACT.

## Matrix

Cell values: tailored / generic / missing / n/a, with a few words. "Home note" means the single Home note and plan, not the daily message.

| Journey | Home note | Jobs | Network | Learn | Skills mapping | Career exploration / pivot | Dossier / Candidate+ | Mental check-ins | Supporters / coach |
|---|---|---|---|---|---|---|---|---|---|
| LAID_OFF | tailored: playbook wks 4 to 40, benefits first | generic board; tailored plan and gates | tailored: tell 10 people, layoff cohort | generic (AI-displaced item only) | generic: matrix and assessments | generic: Pivot paths for all | generic: global 480 min, 5 and 5 | tailored: Support page copy; mood prompt generic | tailored: coaching in week 1 and week 9 steps |
| EXPLORING_MOVE | tailored: explore or quiet plan, driver items, playbook | generic board; Find a job locked while exploring | tailored: quiet conversations, Gmail reason | generic: "close one skill gap" | generic | generic | generic; Confidential ON hides mark | generic (runway steps for layoff worry) | generic; supporters blocked by default |
| GROWING | tailored: review, pay, skills plan; no playbook | tailored menu (case, worth); Reviews and raises tab hidden | tailored: sponsor and mentor steps | generic page, tailored prompts | generic | generic | generic: 5 applications irrelevant | generic | generic; hard conversation in Interview prep |
| PROMOTION | tailored: promotion plan and playbook (active only) | tailored: STAYING menu, case and reviews; Find a job locked | tailored: sponsor meeting | generic: "close one gap" | tailored: next-level gap checklist (in-work), no skills map | n/a / generic | generic | generic | generic; practice the ask |
| CAREER_CHANGE | tailored plan; skills step has no link; playbook active only | generic: matching uses current function unless `isPivoting` | tailored: informational calls, LinkedIn "people in the field" | tailored: trends card; courses generic | generic: matrix and Pivot paths exist, not linked from plan | generic / hidden: Pivot paths for all, prominent only with `isPivoting` | generic | generic | generic |
| STUDENT_NEW_GRAD | tailored: early career module and student plan | tailored: entry window, early career tab; internships missing | tailored: alumni calls, groups | generic page plus checklist course | tailored: major to roles with O*NET skills | tailored: major role picker; Pivot paths prompts for a current job | generic: global targets, no student scaling | generic | generic; executive coaching upsell hidden |
| RETURNING | tailored plan (break story, refresh); playbook active only | generic: full-time default; part-time off | tailored: reconnect colleagues | generic: "refresh one skill" | generic | generic | generic; resume treats leave tags kindly | generic | generic |
| NEXT_ACT | tailored plan and playbook; Confidential ON | tailored: board, advisory, part-time default; Find a job locked in Exploring | tailored: board and fractional conversations | generic | generic: "draft board profile" is text | n/a | generic; hides the mark by default | generic | generic |
| TIME_OFF | tailored: return countdown, light plan | tailored by design: tools locked | tailored: one warm relationship a month | tailored: optional | missing: not asked | generic: shown, not framed for leave | generic: 5 applications irrelevant | generic: asks job status near return, not wellbeing | generic |
| FRACTIONAL | tailored: offering, open days, renewals | tailored menu; Find a job locked; default work types full-time | tailored: renewals, referrals, posts | generic | generic | n/a | generic; Confidential ON; recruiters hidden | generic | generic |
| ENTREPRENEUR | tailored (thin): two text prompts, monthly check-in | n/a: locked | tailored (thin): one door-open conversation | generic | missing: not asked | missing | generic | missing | generic; supporters blocked |

## What I did not verify

- Production values of env flags `IN_WORK_REVIEW_EMAILS_ENABLED`, `EARLY_CAREER_IN_EMAILS`, `MID_LEVEL_IN_EMAILS`.
- Pages I only identified by route and tab: Platforms (https://launchyournextchapter.com/dashboard/platforms) and Marketing plan I did not open.
- The `/start/[persona]` landing pages (route exists under `src/app/start`), which the onboarding comment says pre-answer the situation step.
- Whether the Home daily message is segmented elsewhere (admin console); I found no segmentation in `page-content.ts` or `PageHeaderBoxes`.
- Runtime behavior: everything here is from reading source, plus running `menu.ts` visibility rules in a scratch script.
