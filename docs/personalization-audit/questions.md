# Candidate questions audit: what we ask, where it goes, what it changes

Read-only audit of the candidate site, run against the code on 2026-10-17. It feeds the redesign in which personalization becomes the first strip on Home, Jobs, Network and Learn (see `docs/candidate-redesign.md`): a question stays only if it changes something the member can see.

## Summary

**236 questions or inputs across 33 page groups.** 4 rows are navigation or read-only notes kept for completeness.

| Verdict | Count | Meaning |
|---|---|---|
| KEEP | 125 | Changes data, action, function, tone or outcome for the member. About 20 of these are working-tool records (in-work, review prep, got hired, interview prep, find-a-job tools), not personalization. |
| MERGE | 75 | Same fact asked elsewhere, or several questions that should be one. The row says with which. |
| DROP | 15 | Nothing reads it, or it is only a null check, or real activity already measures it. |
| UNCLEAR | 21 | Only a coach, admin or display page reads it, or the wording or purpose is unclear. Owner decision. |

Of the 236 rows, only the 33 signals in `src/lib/personalization/spine.ts` are mapped to a stated purpose; the rest were never mapped. For the strip, `buildSignals()` in `src/lib/personalization/signals.ts` ("What we know about you", 7 signals) is the best existing model.

### How "Read by" was determined

For each field I searched `src`, `scripts` and `extension` for the field name outside the form and server action that writes it, excluding tests. I did not count as readers: completeness checkers (`lib/search-strategy.ts`, `search-strategy-complete`, `search-strategy-checklist`, `profile-checklist`, `activation-items`, `access-gate`), admin analytics and the monthly report, seed and demo scripts, and the onboarding and Search Strategy actions themselves. Then I opened the reader to see what it does with the value.

| Tag | Reader |
|---|---|
| MATCH | Job matching and scoring: `lib/jobs`, `lib/matching`, `lib/companies`, `lib/personalization/match-inputs.ts` (the 45 fields a retune compares) |
| VIC | Victoria's chat reply, `lib/coach/generate-reply.ts` (reads only 10 profile fields: target role, job status, primary and target function, industry, pivot flag, culture, push style, search intensity, difficulty) |
| STRAT | Victoria's strategy note on https://launchyournextchapter.com/dashboard/search-strategy (`search-strategy-guidance.ts`) and the weekly focus card (`weekly-focus.ts`). Text only, no scores. |
| PLAN | Weekly plan, sprint, engagement cards, `lib/weekly`, `lib/journey/engagement*.ts` |
| MENU | `lib/journey/menu.ts`. It reads **only journey and journeyStage**, no other answer. |
| EMAIL | Cron emails and `lib/email` (daily nudge reads notification tier, target role, confidential mode; job emails read journey, stage, check-in answers, board breadth, sectors) |
| REPORT | Market Reality report, dossier, pay, pivot and market pages |
| LEARN | Learning plan, skill gaps, curated videos |
| COACHV | Coach panel, pre-session brief, recruiter or talent views |
| ADMIN | Admin lists and analytics only |
| NONE | No reader found |

Victoria's **daily message** boxes (`PageHeaderBoxes`, `lib/dashboard/page-content.ts`) are authored content, not generated from the profile; only the Search Strategy page swaps in a checklist-based override. So no answer personalizes the daily message today.

## Facts asked in more than one place

The column that matters is the number of separate places the member is asked. Same field means the second ask overwrites the first.

1. **City and state**: onboarding location; Profile basics; job board "Add your city"; complete-profile card. 4 places, same columns.
2. **Primary function**: onboarding confirm; Search Strategy step 1; job board "Pick your function" links to a Profile section that cannot edit it.
3. **Target role**: onboarding confirm; Search Strategy "Target role" (with a "Flexible" text value); early-career major picker (writes the same column).
4. **Seniority and years**: onboarding (plus "Where are you in your career?"); Search Strategy; Profile "Function & experience"; complete-profile.
5. **Industry**: onboarding "Your industries" (first tag also becomes industryContext); Profile "Industry"; complete-profile; Search Strategy "Target industries"; the "Which industries do you mean?" bucket confirm; sector toggles on Search Strategy and the job board. 7 asks of two different facts (where I worked, where I want to work).
6. **Work setup and location**: remote preference (onboarding, Search Strategy, "days per week from home" in step 5, work-type toggle on the board); relocation (onboarding, Search Strategy); travel (checkbox at onboarding, percentage at Search Strategy).
7. **Pay**: last salary (Profile, complete-profile); minimum comp (Search Strategy step 1 and step 5, same column); compensation flexibility; equity; benefit numbers; review-prep ask amount; target day rate (free text, unread); got-hired pay.
8. **Culture and values**, five instruments: culture fit (importance plus 6 questions plus 2 free-text boxes, asked at onboarding and again as Search Strategy step 3), What I Need (24 ratings plus domain rank), 10 this-or-that work-style questions (Skills Inventory and a Home prompt), How I Work Best (57 items), culture survey prompt on Home.
9. **Deal breakers**, four free-text boxes: "other important considerations"; culture "must have"; culture "will not accept"; coaching intake "non-negotiables".
10. **Job status, timing, stage**: situation card at onboarding; "When do you want to start applying?" and "When do you want to start looking?" (same idea); "What's behind the move?" (same as choosing "worried about a layoff" on the card); Privacy "What's going on" and "Where you are"; in-app "Still searching?" dialog; Saturday email "Still searching?"; Home "Has anything changed?" prompt; coaching intake "date by which you need an offer".
11. **How actively are you looking**: onboarding and Privacy, plus "How difficult has your search been?" (read together with it in `isCasuallySearching`).
12. **Barriers and blockers**: "biggest barriers" (select all), "what tends to get in the way" (select all), consistency self-rating, "anything more personal", coaching intake "most worried about", networking concerns (Search Strategy step 4 and the Network page selector).
13. **Coaching style**, six ways of asking: push style (onboarding and Search Strategy step 2, same wording and same column), progress pace, big change or more of the same, motivations, coach-match communication style plus a style-statement set, intake "check on me or self-direct".
14. **Network comfort**: onboarding (and the `/onboarding/comfort` fallback), Search Strategy step 4, complete-profile gate, Network page selectors.
15. **Interview comfort**: Search Strategy step 5, Interview Prep comfort check, complete-profile card (same column).
16. **Recruiter visibility opt-ins**: resume book is on the upload form, Privacy, the job board and the resume page; recruiter database is on Privacy and the job board.
17. **Thought leadership and LinkedIn**: Search Strategy step 4, Marketing Plan unlock, LinkedIn unlock, complete-profile. Public-visibility comfort also overlaps Confidential Search Mode on Privacy. LinkedIn URL is asked in 4 places.
18. **Skills lists**, five stores of "what I know": resume keywords, skills I have, tools, skill levels matrix, top strengths (plus "what you can teach"). "Skills to build" is on two pages.
19. **Education**: onboarding (school, degree, major, year), early-career page, Profile degree checklist (a separate store matching reads).
20. **Fractional and interim interest**: Search Strategy checkbox; board advisory (step 6 and the interim work page); independent-work grid; work-type toggle on the board; the fractional journey.
21. **Self-reported search activity that the app can measure**: applications so far, interviews so far, networking level, new skills learned, weekly outreach target, application goal.
22. **Commitment**: the contract screen and the welcome-page button.
23. **Coach sharing consent**: onboarding and Privacy "Coach access".
24. **Having a coach**: coaching intake, the confidential disclosure, and Search Strategy "anything more personal you want your coach to know".

## Top 10 questions nothing reads

Zero reader outside the form, the completeness checks and admin lists. Row numbers are in the table below.

| # | Question | Row | Evidence |
|---|---|---|---|
| 1 | "I'm willing to follow up on applications I've submitted" (`willingToFollowUpOnApplications`) | 103 | Only the form and its action touch it. Also listed in `docs/OPEN_ITEMS.md`. |
| 2 | "I just started" checkbox in onboarding (`justStartedSearch`) | 25 | Written and never read. |
| 3 | "When are you most ready to take action?" (`actionWindow`) | 204 | The copy says the daily email arrives in that window. No cron or email reads it. |
| 4 | "How do you feel about being open about your job search on LinkedIn?" (`linkedinOpennessComfort`) | 127 | Written by two forms, read by none. |
| 5 | "New networking outreach messages per week you're aiming for" (`networkingOutreachTargetPerWeek`) | 132 | Only the completeness check; the Network page never reads it. |
| 6 | "Do you want to work somewhere that's animal/pet-friendly?" (`wantsAnimalFriendlyWorkplace`) | 74 | Only the screening page that asks it. |
| 7 | Restrictive covenant details box (`restrictiveCovenantDetails`) | 71 | Nothing displays or uses it (the yes/no does drive a plan step). |
| 8 | Street address (`streetAddress`) | 58 | Only the Profile form and the resume parser that fills it. |
| 9 | Independent or part-time work grid, four sub-questions (`independentWorkExperience`) | 145 | Only the form re-reads it to prefill itself. |
| 10 | "Are you prepared to commit to 8 to 12 hours a week?" (`contractAccepted`) | 40 | Only the admin declined-commitment list and the monthly report. The copy says declining lowers the bar for an A; no scoring code reads it. |

Next in line (read only as an "answered" check, or only by a coach panel): the free-text day-rate answer used as a gate (87), motivations free text (119), applications so far and interviews so far (26, 27), networking level (146), recruiter connection count (149), pitch-ready slider (82, 188).

## Where the existing spine overclaims

`docs/PERSONALIZATION_SPINE.md` says each answer drives something, and a test checks that each listed file mentions the field. That test passes on files that only check "was it answered". Verified against the code:

- **Blockers**: spine says it puts the first plan step against the biggest blocker. No plan code reads it. `probability.ts` explicitly excludes it. Readers are the strategy note and the coach panel.
- **Change readiness and progress pace**: spine says big leaps or baby steps in the weekly plan. Only the strategy note reads them.
- **Motivations**: spine says the coach uses it on a hard day. The chat reply does not read it; the strategy note, market-reality page text and coach panel do.
- **Willing to start lower**: spine says it widens the shortlist. It changes the per-job "why this fits" score and wording, and is not one of the 45 fields matching compares on a retune.
- **Negotiation comfort**: the form says it shapes suggested skills; only the video order changes.
- **Contract, action window, benefits**: promises in the copy that no code keeps (benefits only prints an ask list on https://launchyournextchapter.com/dashboard/pay).

## Findings that affect the redesign

1. Only **journey + stage** reach the menu. Everything else the member says reaches the strategy note, matching, the plan or an email, never the navigation.
2. The matching pipeline reads 45 profile fields (`MATCH_INPUT_FIELDS`). Anything not in that list does not change a retune result: target company stage, equity, interim interest, willing to start lower, deal breakers, application goal, work style, work interests are used elsewhere (per-job read, score nudge) but cannot be shown as "N matches before and after".
3. "What we know about you" weights city 25, title 20, tools 20, industries 15, function 10, work setup 10, clearance 0. Its function link goes to a Profile section that cannot edit function.
4. Complete-profile re-shows forms that live on other pages (Profile, Search Strategy, Interview Prep, Network, Marketing Plan, LinkedIn) as a points checklist, so each of those questions has two homes.
5. `src/app/onboarding/working-style` has no inbound link, and `updateSituation` marks the assessment complete, so the 57-item How I Work Best questionnaire is only reachable through the retake page.
6. `updateSmsConsent` exists in the Privacy actions with no form calling it.
7. `docs/OPEN_ITEMS.md` has an older "consumer mapping audit". Since then red-flag answers (plan steps) and benefits (ask list) gained readers; `actionWindow` and `willingToFollowUpOnApplications` still have none.
8. Out of scope here but asked on candidate pages: Track Record (`https://launchyournextchapter.com/dashboard/track-record`, 19 items, flagged as unread in OPEN_ITEMS), References, Network page selectors.

## Table

Verdict key: KEEP, MERGE (with the row named in Why), DROP, UNCLEAR. "Changes" uses data, action, function (a feature), tone (messaging) and outcome. Pages are grouped by full URL; the group heading is the page where the question is asked.

### https://launchyournextchapter.com/onboarding/desire

Onboarding: situation picker

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 1 | situation cards | Which of these sounds like you? (11 cards: laid off or left, working and thinking about a move, happy where I am, promotion, changing careers, student or new grad, returning after a break, planning my next act, on leave, fractional and happy, starting something of my own) | CandidateProfile.journey, .journeyStage (start stage), .currentJobStatus, .confidentialSearchMode (default) | MENU (menu.ts keys only on journey+stage), PLAN (sprint, auto-advance), EMAIL (job-search-daily eligibility), VIC (job status line), REPORT, MATCH (apply-kit) | function, action, tone | **KEEP** | Root answer; every stage rule, menu and plan keys off it. Re-asked later as check-in and Privacy situation (same fact, see those rows). |

### https://launchyournextchapter.com/onboarding/resume

Onboarding: resume

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 2 | upload | Upload your resume (PDF or DOCX, up to 10MB) | Resume row + about 10 prefilled profile fields (resumePrefilledFields) | MATCH (title, keywords, skills, industry), LEARN, REPORT | data, outcome | **KEEP** | Biggest single source of data; saves asking 15+ questions. |
| 3 | upload | Align to a narrative (optional) | Resume.narrativeId | Portfolio (resumes aligned to a narrative) | function | **UNCLEAR** | Needs a narrative that does not exist at onboarding; meaning not obvious to a new member. |
| 4 | upload | Include in the resume book (checkbox) | CandidateProfile.resumeBookOptIn | COACHV (recruiter resume book), action-verification | outcome | **MERGE** | Same opt-in as Privacy "Resume Book" and a form on the job board; keep one place (Privacy). |

### https://launchyournextchapter.com/onboarding/confirm

Onboarding: confirm what we read

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 5 | confirm | Where are you in your career? (Student or new grad 0-2y / Early career 2-5y / Experienced 5+) | No column; sets yearsExperience default and the early-career audience | PLAN (early-career audience), MATCH (via years) | function | **MERGE** | Overlaps "Years of professional experience" two fields below; ask one. |
| 6 | early only | Your school | EducationEntry.schoolName | PLAN (early-career plan, build-learning-plan), resume editor | function | **KEEP** | Only shown to new grads and early career; feeds the early-career plan. Same data asked again on the early-career page and Profile. |
| 7 | early only | Degree | EducationEntry.degree | PLAN (early-career), Universities page | function | **MERGE** | Profile has a separate degree checkbox list (highestEducationLevel, hasJD/hasMD) that matching reads; two degree stores. |
| 8 | early only | Major | EducationEntry.fieldOfStudy | PLAN (early-career major to target role) | function | **KEEP** | Drives the first target role suggestion for new grads. |
| 9 | early only | Graduation year | EducationEntry.graduationDate | Display only (Universities page, admin candidate profile) | none | **UNCLEAR** | Nothing computes from it (for example months to graduation); infer from resume if needed. |
| 10 | confirm | The highest level you have reached | CandidateProfile.highestLevelReached (+ levelRankScore) | MATCH (level window, 18 files), REPORT, PLAN, COACHV | data, outcome | **KEEP** | Core matching input. Asked again on Search Strategy ("Seniority"). |
| 11 | confirm | Years of professional experience | CandidateProfile.yearsExperience | MATCH (board-readiness, job-match, cover note), REPORT | data, outcome | **KEEP** | Core input. Asked again in Profile "Function & experience". |
| 12 | confirm | Your primary job function | CandidateProfile.primaryFunction | MATCH (24 files), VIC, REPORT, LEARN, EMAIL | data, outcome | **KEEP** | Core input. Asked in 4 places (here, Search Strategy, Profile edit link, job board "Pick your function"). |
| 13 | confirm | What role are you targeting next? | CandidateProfile.targetRoleType | MATCH, VIC, STRAT, LEARN, REPORT, EMAIL (daily nudge) | data, tone, outcome | **KEEP** | Core input. Asked again on Search Strategy and by the early-career major picker. |
| 14 | confirm | Your industries (tags) | CandidateProfile.targetIndustries; first tag is also industryContext | MATCH (industry first), VIC (industryContext), LEARN, REPORT | data, outcome | **KEEP** | Mixes "where I worked" and "where I want to work" in one list; asked 4 more times (Profile "Industry", Search Strategy, complete-profile, sector toggles). |

### https://launchyournextchapter.com/onboarding/location

Onboarding: where you search from, search status, one more thing The old /onboarding/comfort page is a fallback for the same network-comfort question.

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 15 | city | City | CandidateProfile.currentCity | MATCH (commute radius; 25% of the "tuned" meter), EMAIL, PLAN | data, outcome | **KEEP** | Single most valuable matching signal. Asked in 4 places (here, Profile Basics, job board "Add your city", complete-profile). |
| 16 | state | State | CandidateProfile.currentState | MATCH | data, outcome | **KEEP** | Pairs with city. |
| 17 | work setup | Work-location preference (On-site / Remote / Hybrid / I am easy going) | CandidateProfile.remotePreference | MATCH (remote counts as local), REPORT, PLAN | data, outcome | **KEEP** | Asked again on Search Strategy "Location preference" and via benefits "days per week from home". |
| 18 | work setup | I am open to relocating (+ notes) | CandidateProfile.openToRelocation, .relocationNotes | MATCH (relocation states), REPORT, STRAT | data, outcome | **KEEP** | Asked again on Search Strategy. |
| 19 | work setup | I am willing to travel for a role (not the same as relocating) | CandidateProfile.travelWillingness | MATCH (requirements, apply-kit) | data | **MERGE** | Search Strategy asks the same thing as a percentage (maxTravelPct) and sets this flag from it. |
| 20 | employed only | When do you want to start applying? (Now / 1-3 months / 3-6 months / Just curious) | journeyDetails.applyTiming; sets journeyStage and searchIntensity | MENU, PLAN, EMAIL | function, action | **KEEP** | Sets the stage. Same fact as the check-in dialog, Privacy "Where you are", and "How actively are you looking?". |
| 21 | not employed | How long have you been searching? (0-3 / 3-6 / 6-12 / 12+ months) | CandidateProfile.gapDuration | REPORT (market-reality grade, named reasons), STRAT, weekly focus | tone, outcome | **KEEP** | Asked again on Search Strategy. Wording says "searching" but the use is "time out of work"; also goes stale. |
| 22 | not employed | Was AI part of why your last role ended? (optional) | CandidateProfile.aiJobLossReason | PLAN (engagement.ts aiOutlookItems) | action | **KEEP** | Adds one plan step for members it applies to; sensitive, optional. |
| 23 | not employed | How actively are you looking? (Actively looking / Casually looking) | CandidateProfile.searchIntensity | PLAN (pace and point target), VIC (directness), REPORT, EMAIL | action, tone | **KEEP** | Also asked on Privacy "Your situation"; employed members get it derived from the apply-timing answer. |
| 24 | not employed | I am earning from fractional, interim or part-time work right now | journeyDetails.workingNow | PLAN (engagement, intensity) | action, tone | **KEEP** | Small, but changes plan pressure. |
| 25 | not employed | I just started (skip the counts) | CandidateProfile.justStartedSearch | NONE (only the writer reads it) | none | **DROP** | Nothing reads it; it only zeroes the two counts below. |
| 26 | not employed | How many roles have you applied to? | CandidateProfile.jobsAppliedBucket (derived bucket) | PLAN (sprint, action-verification: null check only) | none | **DROP** | Only checked for "answered"; the app measures real applications once the member tracks them. |
| 27 | not employed | How many interviews have you had? | CandidateProfile.interviewsReceivedCount | PLAN (activity-reconciliation compares to detected interviews; null check) | none | **DROP** | Self-report that real tracked activity replaces; value never changes what the member sees. |
| 28 | employed, thinking about a move | What is behind the move? (Keeping options open / Ready to leave / Worried about a layoff) | journeyDetails.moveDriver | PLAN (sprint: layoff worry puts runway first), REPORT | action, tone | **MERGE** | Same fact as picking "worried about a layoff" vs "ready to move" on the first card. |
| 29 | laid off | When do you want to start looking? (Right away / In a few weeks / After some time off) | journeyDetails.startTiming; sets journeyStage | MENU, PLAN | function, action | **MERGE** | Same fact as "When do you want to start applying" for employed members; one timing question for everyone. |
| 30 | on leave | When do you expect to be back? | journeyDetails.returnDate | PLAN (engagement countdown) | action | **KEEP** | Only shown to the on-leave journey. |
| 31 | fractional | In one line, who do you help and what result do you deliver? (optional) | journeyDetails.offering | PLAN (engagement.ts) | action | **KEEP** | Fractional journey only; becomes the pitch line. |
| 32 | fractional | Days a week open for new work | journeyDetails.openDays | PLAN (engagement.ts pipeline step) | action | **KEEP** | Fractional journey only. |
| 33 | fractional | When does your current engagement end? | journeyDetails.engagementEnds | PLAN (renewal step 30-45 days before) | action | **KEEP** | Fractional journey only. |
| 34 | searching | How much do company culture and working environment matter to you? (Not / Somewhat / Very important) | CandidateProfile.cultureFit.importance | VIC (culture line), MATCH (analyze-job-fit evidence), STRAT, REPORT, interview-prep CultureQuestionsCard | tone, function | **KEEP** | Gate for the next 8 answers. Same data re-editable on Search Strategy step 3. |
| 35 | searching, if it matters | Six culture questions: How fast do you like to work? / How much structure do you want? / How do you like to work with others? / What kind of manager helps you most? / What do you need from hours and flexibility? / What do you want from the job over time? | cultureFit.answers (6 keys) | MATCH (analyze-job-fit "why this fits"), PLAN (interview questions to ask), STRAT | function, outcome | **MERGE** | Third instrument for the same thing as "What I Need" (24 items) and the 10 this-or-that work-style questions; keep one. |
| 36 | searching, if it matters | One thing a workplace must have | cultureFit.mustHave | PLAN (interview checks), STRAT | action | **MERGE** | Overlaps "Are there any other important considerations" (dealBreakers) and "One thing you will not accept". |
| 37 | searching, if it matters | One thing you will not accept | cultureFit.dealBreaker | PLAN (interview checks), STRAT | action | **MERGE** | Same as above: three free-text deal breaker boxes in one flow. |
| 38 | one more thing | How comfortable do you feel letting your network know you are looking for a role? (Very / Somewhat / Not very / I would rather not) | CandidateProfile.networkComfortLevel | Network page (outreach plan card, scripts), STRAT | function, tone | **KEEP** | Asked 4 times: here, /onboarding/comfort fallback, Search Strategy step 4, and the Network gate (complete-profile). |
| 39 | one more thing | When you are stuck, what kind of push works better for you? (optional) (Tough love / Gentle encouragement / A mix of both) | CandidateProfile.coachingStylePreference | VIC (directness), PLAN (stalled/unlock wording), STRAT, REPORT | tone | **KEEP** | Strongest tone input. Asked word for word again on Search Strategy step 2. |

### https://launchyournextchapter.com/onboarding/contract

Onboarding: contract

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 40 | contract | Are you prepared to commit to 8 to 12 hours of high-quality activity each week? (Yes, I am ready to commit / Not right now, tell me more) | CandidateProfile.contractAccepted, .contractAcceptedAt | ADMIN only (declined-commitment list, monthly report) | none | **DROP** | Copy promises a lower bar for an A if declined, but no scoring or plan code reads it. Asked again as "I am committed" on the welcome page. |

### https://launchyournextchapter.com/onboarding/coach-consent

Onboarding: coach consent (coach-invited members only)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 41 | consent | Share with {coach}? (Agree / Not now) | CandidateProfile.coachDossierConsentedAt | COACHV (dossier, coaching notes, weekly digest, messaging threads) | outcome | **KEEP** | Consent record; only for coach-invited members. Same switch lives in Privacy "Coach access". |

### https://launchyournextchapter.com/onboarding/coaching-form

Onboarding / dashboard: coaching intake form (coach-linked members only) Same eight baseline questions at the dashboard URL for the form: https://launchyournextchapter.com/dashboard/coaching-form. Coaches can add custom questions; answers sit in CoachingOnboardingResponse.answers (Json keyed by question id).

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 42 | baseline | What does a successful outcome from our work together look like to you? | CoachingOnboardingResponse.answers.successOutcome | COACHV (client page) | outcome | **KEEP** | Coach reads it; no automation. Coach-only. |
| 43 | baseline | Is there a date by which you need to have accepted an offer? | answers.offerDeadline | COACHV | outcome | **MERGE** | Timeline fact; same family as apply timing and runway. Not used by plan. |
| 44 | baseline | Have you worked with a career or executive coach before? What worked, what did not? | answers.priorCoaching | COACHV | outcome | **KEEP** | Coach-only context. |
| 45 | baseline | Preferred session cadence (Weekly / Biweekly / As-needed) | answers.sessionCadence | COACHV | outcome | **KEEP** | Logistics for the coach. |
| 46 | baseline | Preferred between-session contact (Email check-ins / Text / None unless urgent) | answers.betweenSessionContact | COACHV | outcome | **KEEP** | Logistics for the coach. |
| 47 | baseline | Do you want to be checked on if you fall behind, or do you prefer to self-direct? | answers.accountabilityStyle | COACHV | outcome | **MERGE** | Coaching style asked a 4th time (with push style, pace, coach-match communication style). |
| 48 | baseline | Non-negotiables or constraints on your search (location flexibility, caregiving, industries to exclude) | answers.nonNegotiables | COACHV (pre-session brief) | outcome | **MERGE** | Same fact as Search Strategy "other important considerations" (dealBreakers). |
| 49 | baseline | What are you most worried about in this process? | answers.biggestWorry | COACHV (pre-session brief) | outcome | **MERGE** | Same fact as blockers and biggest barriers. |
| 50 | disclosure | One optional, confidential question: Tell your coach what they should know | CoachingConfidentialDisclosure.disclosureText | COACHV (coaching notes panel only) | outcome | **KEEP** | Coach-only by design. Search Strategy also has "Anything more personal you want your coach to know?" (see that row). |

### https://launchyournextchapter.com/onboarding/create-account

Onboarding: create account and welcome

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 51 | create-account | Email address | Supabase auth user + CandidateProfile.email | EMAIL (all), login | function | **KEEP** | Account creation. |
| 52 | welcome | One quick question: how did you hear about NextChapter? (+ Who recommended it? optional) | CandidateProfile.leadSource, .leadSourceDetail; Referral rows | ADMIN/monthly report; referral credit for the referrer | outcome (for the referrer) | **UNCLEAR** | Marketing attribution, not personalization; nothing the member sees changes. Decide whether it stays in onboarding. |
| 53 | welcome | I am committed, take me to my dashboard (button, earns welcome bonus points) | CandidateProfile.introCommittedAt | PLAN (first sprint bonus points) | data | **MERGE** | Second commitment ask after the contract screen; one is enough. |

### https://launchyournextchapter.com/onboarding/working-style

Onboarding: How do you prefer working (page has no inbound link; onboarding now marks the assessment complete at the situation step)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 54 | assessment | How I Work Best: 57 items (4-point agreement) plus quad blocks "least like me". Same instrument as https://launchyournextchapter.com/dashboard/retake-assessment | CandidateAssessmentResponse.dimensionVectors; archived raw answers | REPORT (dossier competencies, self-awareness vs references), per-job work-style read (work-profile-load), pivots | function, outcome | **UNCLEAR** | Orphaned entry point; the retake page asks the same 57 items. Matching-grade value is small compared with 10 this-or-that questions. |

### https://launchyournextchapter.com/dashboard/profile

My Profile (hub)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 55 | hub | No questions on this page. It lists cards that link to Personal information, Screening, Resume. | n/a | n/a | n/a | **KEEP** | Pure navigation. |

### https://launchyournextchapter.com/dashboard/profile/personal

My Personal Information (also the confirm cards at https://launchyournextchapter.com/dashboard/complete-profile)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 56 | Basics | First name, Last name | CandidateProfile.firstName, .lastName | UI everywhere (greetings), EMAIL, apply-kit | tone | **KEEP** | Basic identity. |
| 57 | Basics | Phone | CandidateProfile.phone | apply flows (NativeApply), resume export, contacts | function | **KEEP** | Used when applying and exporting the resume. |
| 58 | Basics | Street address | CandidateProfile.streetAddress | NONE (only the form and resume parser write/show it) | none | **DROP** | No reader; also sensitive. |
| 59 | Basics | City, State (again) | currentCity, currentState | MATCH | data | **MERGE** | Same as onboarding location and job board "Add your city". |
| 60 | LinkedIn | LinkedIn URL (+ "I do not have one yet" checkbox) | CandidateProfile.linkedInUrl, .linkedInConfirmedAt | VIC (URL on file yes/no), apply-kit, LinkedIn page, member public profile | function | **KEEP** | Asked 4 times (here, complete-profile, LinkedIn page URL form, resume). The checkbox only sets confirmed, no other effect. |
| 61 | Picture | Profile picture (optional) | avatar upload | UI, community, member profile | function | **KEEP** | Visible identity. |
| 62 | Education | Education (checkboxes: high school ... doctorate) | CandidateProfile.highestEducationLevel, .hasJD, .hasMD, .hasMBA | MATCH (hasJD/hasMD credential gates in match-inputs), resume, college score, warm paths | data, outcome | **MERGE** | Overlaps the degree answer at onboarding and early-career; keep one degree question. |
| 63 | Industry | Industry (free text) | CandidateProfile.industryContext | MATCH (8 files), VIC, REPORT, LEARN | data, outcome | **MERGE** | Same fact as onboarding "Your industries" and Search Strategy "Target industries". |
| 64 | Function & experience | Latest job title | CandidateProfile.resumeLatestJobTitle | MATCH (sub-function classifier; 20% of the tuned meter), skill-gap suggestions, early-career | data, outcome | **KEEP** | Narrows matching to the exact kind of work. Prefilled from resume. |
| 65 | Function & experience | Years of experience | CandidateProfile.yearsExperience | MATCH, REPORT | data, outcome | **MERGE** | Same as onboarding confirm. The "Primary function" line here is read-only and links away to Search Strategy. |
| 66 | Salary | Last salary (or decline to answer) | CandidateProfile.lastSalary, .salaryConfirmedAt | REPORT (pay position, offered wages), MATCH (job-match salary read), PLAN (negotiation advice) | data, outcome | **KEEP** | Pay benchmark. Asked once here and once as complete-profile card. |
| 67 | Resume keywords | Resume keywords (tags) | CandidateProfile.resumeKeywords | MATCH (match-inputs), skill-gap suggestions, member profile | data, outcome | **MERGE** | Overlaps "Skills you have" and "Tools you use"; three lists of what the member knows. |
| 68 | Can teach | What you can teach others | CandidateProfile.canTeach | member public profile page, higher-ed programs screen (display only) | none | **UNCLEAR** | Display only; no matching or plan effect. |

### https://launchyournextchapter.com/dashboard/profile/screening

Screening questions

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 69 | Screening | Were you let go for cause, rather than a no-fault layoff? (shown to laid-off) | CandidateProfile.firedForCause | PLAN (redFlagGuidance step: prepare an honest answer) | action | **KEEP** | Adds one interview-prep step. |
| 70 | Screening | Do you have a non-compete, non-solicit, or other restrictive covenant that could affect your next role? (+ details) | hasRestrictiveCovenant, restrictiveCovenantDetails | PLAN (redFlagGuidance step: read your covenant); details: NONE | action | **KEEP** | Yes/no drives one plan step. The details box has no reader (see next row). |
| 71 | Screening | Restrictive covenant details (free text) | CandidateProfile.restrictiveCovenantDetails | NONE | none | **DROP** | Nothing displays or uses it. |
| 72 | Screening | Are you willing to undergo a background check if an employer requires one? | willingToTakeBackgroundCheck | PLAN (redFlagGuidance) | action | **KEEP** | Only fires when answered "no". |
| 73 | Screening | Are you willing to take a drug test if an employer requires one? | willingToTakeDrugTest | PLAN (redFlagGuidance) | action | **KEEP** | Only fires when answered "no". |
| 74 | Screening | Do you want to work somewhere that is animal/pet-friendly? | wantsAnimalFriendlyWorkplace | NONE | none | **DROP** | No reader anywhere. |
| 75 | Screening | Do you hold a US security clearance? (level, active/lapsed, polygraph; optional) | clearanceLevel, clearanceActive, clearancePolygraph | MATCH (cleared jobs flagged and filtered, requirements.ts), know-you card | data, outcome | **KEEP** | Directly changes which jobs are marked qualified. |
| 76 | Screening | Which of these licenses do you hold? (optional) | licensesHeld, licensesAnsweredAt | MATCH (requirements.ts) | data, outcome | **KEEP** | Directly changes license-gated job matches. |
| 77 | Demographics | Optional demographic self identification: gender identity, race/ethnicity, disability status, veteran status | CandidateProfile.eeocGenderIdentity, .eeocRaceEthnicity, .eeocDisabilityStatus, .eeocVeteranStatus | ADMIN only (bias-detection aggregates); never to employers | none for the member | **UNCLEAR** | Compliance audit data. Does not change anything the member sees; keep it out of the personalization strips and decide separately. |
| 78 | Work authorization | Work authorization (select) and Visa status (select) | workAuthorization, visaStatus (defaults to authorized, no sponsorship) | MATCH (requirements.ts), apply-kit, native apply, coach notes | data, outcome | **KEEP** | Filters sponsorship-gated jobs. Default pre-selected means a "confirm" click carries little information. |

### https://launchyournextchapter.com/dashboard/complete-profile

Complete Your Profile (points checklist that re-surfaces forms from other pages)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 79 | checklist | Confirm cards: Basics, Industry, Function & experience, Last salary, LinkedIn, profile picture | same columns as Profile > Personal | same as the Profile rows | data | **MERGE** | Pure repeat of the Profile page, rewarded with points; remove the second surface. |
| 80 | checklist | Confirm your work authorization / Complete your Search Strategy questions (links, 5 pts each) | links to Screening and Search Strategy | n/a | none | **MERGE** | Link rows only. |
| 81 | checklist | Privacy tier selector (Public / Semi-Public / Private / Stealth / Locked) | CandidateProfile.privacyTier | COACHV (talent search, candidate cards, share pages), community | outcome | **KEEP** | Same control as Privacy. Five options shown as buttons with one description at a time. |
| 82 | checklist | Interview Prep Comfort Check (story / interview / elevator pitch) | storyComfort, interviewComfort, elevatorPitchReady | see Interview Prep rows | data | **MERGE** | Same three sliders as Interview Prep. |
| 83 | checklist | Network comfort check | networkComfortLevel | see onboarding row | data | **MERGE** | Same question again. |
| 84 | checklist | Work sample type gate (Writing / Code / Design / Something else) | CandidateProfile.workSampleType | Work samples page (gate) | function | **UNCLEAR** | Only decides which empty state the work-samples page shows. |
| 85 | checklist | Marketing plan unlock: kind of thought leadership; do you like doing these pieces? | contentVenues, contentComfortLevel | see Search Strategy step 4 | data | **MERGE** | Same two questions as Search Strategy step 4. |
| 86 | checklist | LinkedIn unlock: open about your search on LinkedIn; how much you use LinkedIn; is your profile up to date | linkedinOpennessComfort, linkedinUsageFrequency, linkedinProfileUpToDate | see Search Strategy step 4 | data | **MERGE** | Same three questions as Search Strategy step 4. |
| 87 | checklist | Gig directory unlock: What is your target rate or day-rate range for interim work, so this feels realistic? | CandidateProfile.gigDirectoryUnlockAnswer (free text) | Interim work page and launch plan check the answer exists, never its content | function (unlock only) | **DROP** | A free-text question used as a gate; the text is never read. Replace with an explicit unlock or capture a number. |

### https://launchyournextchapter.com/dashboard/search-strategy

Search Strategy (7-page wizard). Victoria's strategy note at the top of this page is generated from many of these answers (STRAT) and cleared every time Step 1 is saved.

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 88 | Step 1 | How long have you been searching? | gapDuration | REPORT, STRAT | tone, outcome | **MERGE** | Duplicate of onboarding gap question; one place only. |
| 89 | Step 1 | Target industries (tags) | targetIndustries | MATCH, VIC, LEARN, REPORT, COACHV | data, outcome | **MERGE** | Duplicate of onboarding "Your industries" and Profile "Industry". |
| 90 | Step 1 (banner) | Which industries do you mean by "{what you typed}"? (confirm or add buckets) | industryBuckets, industryBucketsConfirmedAt | MATCH (match-inputs industryBuckets), market size | data, outcome | **MERGE** | Exists only because industries are free text; a picker at the first industry question removes this follow-up. |
| 91 | Step 1 | Your primary job function | primaryFunction | MATCH, VIC, LEARN, REPORT | data, outcome | **MERGE** | Duplicate of onboarding confirm. |
| 92 | Step 1 | Add a second job function | secondaryFunction | MATCH (compute-match-score, job-fit-bucket, company ranking), FreshJobs | data, outcome | **KEEP** | Widens matches to a second function. Not asked elsewhere. |
| 93 | Step 1 | Seniority: highest level reached ("Drives how jobs are matched to you.") | highestLevelReached | MATCH | data, outcome | **MERGE** | Duplicate of onboarding confirm. |
| 94 | Step 1 | Target role (+ "I am flexible, open to a range of roles") | targetRoleType (value "Flexible") | MATCH, VIC, STRAT, LEARN, REPORT | data, outcome | **MERGE** | Duplicate of onboarding; "Flexible" is stored as text, so every reader must special-case it. |
| 95 | Step 1 | I am considering a career pivot to a different role or function, not just changing employers | isPivoting | MATCH (pivot board filter), VIC, STRAT, REPORT (pivot paths), LEARN | function, outcome | **KEEP** | Switches on pivot features. Overlaps the "Changing careers" journey. |
| 96 | Step 1 (if pivoting) | Target job function | targetFunction | MATCH (role matches), VIC, STRAT, REPORT (pay, trends), LEARN, EMAIL | data, outcome | **KEEP** | Only meaningful with the pivot flag. |
| 97 | Step 1 | I am willing to start at a lower level or title | willingToStartLower | MATCH (per-job "why this fits" score and wording; not in the retune input list), STRAT, REPORT | outcome | **KEEP** | Changes the per-job read, not which jobs enter the shortlist. |
| 98 | Step 1 | Why? (optional, but helps employers understand the offer) | startLowerRationale | COACHV (coaching notes) only | none for the member | **UNCLEAR** | Wording says employers see it; only the coach panel shows it. |
| 99 | Step 1 | Target company size | targetCompanySize | MATCH (company ranking, job-fit-bucket), REPORT, STRAT | data, outcome | **KEEP** | Ranks companies. |
| 100 | Step 1 | Target company type (startup, growth, enterprise, non-profit) | targetCompanyStage | MATCH (interim marketplace tailoring, job-match), STRAT, market-reality page | data, outcome | **KEEP** | Used, though not in the retune input list. |
| 101 | Step 1 | Location preference | remotePreference | MATCH | data, outcome | **MERGE** | Duplicate of onboarding. |
| 102 | Step 1 | Applications per week you are aiming for (optional; default 15) | applicationVolumeGoal | PLAN (daily "apply today" check-in count), STRAT, weekly focus | action, tone | **KEEP** | Sets the daily ask. Default is pre-filled, so most members never choose. |
| 103 | Step 1 | I am willing to follow up on applications I have submitted | willingToFollowUpOnApplications | NONE | none | **DROP** | Collected, never read anywhere (also listed as an orphan in docs/OPEN_ITEMS.md). |
| 104 | Step 1 | What is the minimum comp you are able to take? (optional) | targetCompMin | MATCH (pay filter, salary read), REPORT (market pay, "% of roles clear your floor"), PLAN (negotiation), COACHV | data, outcome | **KEEP** | Asked on Step 1 and again in Step 5 (same field); keep one. |
| 105 | Step 1 | I have flexibility on compensation | compFlexible | MATCH (job-match salary read, compute-match-score), STRAT, COACHV | outcome | **KEEP** | Softens the salary read. |
| 106 | Step 1 | Equity matters to me | equityImportant | MATCH (job-match), PLAN (negotiation advice), work profile | outcome | **KEEP** | Small, but changes negotiation text. |
| 107 | Step 1 | I am open to relocating for the right role (+ relocation notes) | openToRelocation, relocationNotes | MATCH | data, outcome | **MERGE** | Duplicate of onboarding. |
| 108 | Step 1 | How much travel can you take on? (not the same as relocating) (0 / 25 / 50 / 75 percent) | maxTravelPct (also sets travelWillingness) | MATCH (requirements.ts travel filter) | data, outcome | **KEEP** | The better version of the onboarding travel checkbox. |
| 109 | Step 1 | I would consider fractional or interim consulting work while I search | interimConsultingInterest | MATCH (work-type filter), STRAT, weekly focus, COACHV | function, outcome | **MERGE** | Overlaps board advisory, independent-work grid, and the fractional journey. |
| 110 | Step 1 | Rank what matters most: maximizing compensation, recognizable brand, job security, work-life balance, mission | priorityMaxComp, priorityBrandName, priorityJobSecurity, priorityWorkLife, priorityMission | MATCH (priorityMultiplier, fit bucket; job security not weighted), COACHV, talent search | outcome | **KEEP** | Weights the fit score. Five-way ranking with arrow buttons is heavy; job security has no matching weight. |
| 111 | Step 1 | Are there any other important considerations for your next job? (optional) | dealBreakers | STRAT, REPORT, weekly focus, coach notes (not matching) | tone | **MERGE** | Three more free-text "deal breaker" boxes elsewhere (culture, coaching intake). |
| 112 | Step 1 | Which employers do you want jobs from? (sector toggles) | hiddenEmployerSectors | MATCH (board shortlist), EMAIL (job emails) | data, outcome | **KEEP** | Hides sectors from board and emails. Also on the job board. |
| 113 | Step 2 | How difficult has your job search been so far? (4 stops) | jobSearchDifficultyLevel | VIC (directness), PLAN (pace), REPORT, engagement | tone, action | **MERGE** | Read together with searchIntensity in isCasuallySearching(); one "how is it going" question. |
| 114 | Step 2 | What do you think are the biggest barriers to getting a new job? (select all) | biggestBarriers | REPORT (market-reality-report text; one rewrite-action trigger for skills gap) | tone | **MERGE** | Same idea as the next question; two overlapping barrier lists. |
| 115 | Step 2 | What tends to get in the way, if anything? (select all) | blockers | STRAT, COACHV; scoring explicitly excludes it | tone | **MERGE** | Merge with biggest barriers. The spine says it reorders the plan; no plan code reads it. |
| 116 | Step 2 | How would you describe your consistency week to week? | consistencySelfRating | COACHV only (coaching notes) | none for the member | **UNCLEAR** | Coach display only; real weekly activity is measured. |
| 117 | Step 2 | Anything more personal you want your coach to know? (optional) | blockersOpenText | COACHV only | none for the member | **MERGE** | Same intent as the confidential disclosure to the coach. |
| 118 | Step 2 | What is driving your search right now? (select up to N) | motivations | STRAT, market-reality page text, COACHV; Victoria chat does not read it | tone | **MERGE** | Part of "how should Victoria talk to me"; merge with coaching push style. |
| 119 | Step 2 | What gets you up in the morning? ... (optional, in your own words) | motivationsElaboration | COACHV only | none for the member | **DROP** | Free text shown only to a coach panel. |
| 120 | Step 2 | When you are stuck, what kind of push works better for you? | coachingStylePreference | VIC, PLAN, STRAT, REPORT | tone | **MERGE** | Word-for-word repeat of the onboarding question (same column). |
| 121 | Step 2 | How do you like to make progress? (Small steady steps / Bigger leaps / Mix) | changePacePreference | STRAT only | tone | **MERGE** | Spine says it sizes the weekly plan; no plan code reads it. Fold into one coaching style question. |
| 122 | Step 2 | Are you looking for a big change, or more of the same? (3 options) | changeReadiness | STRAT only | tone | **MERGE** | Overlaps isPivoting and willingToStartLower; no plan reader. |
| 123 | Step 3 | Culture and working environment: importance, six dimension questions, must-have, will-not-accept | cultureFit (Json) | same readers as the onboarding culture rows | function, outcome | **MERGE** | Same questions as onboarding; this is the edit surface. |
| 124 | Step 4 | How comfortable are you being publicly visible as job-searching (Open to Work, a public post), separate from telling people you know? | publicDisclosureComfort | Marketing Plan page (low-comfort framing instead of public posting prompts), coach notes | function | **MERGE** | Overlaps Confidential Search Mode on Privacy. |
| 125 | Step 4 | What kind of thought leadership have you done, or would you try? (venues) | contentVenues | Marketing Plan (unlock gate, tutorials, studio venue list) | function | **KEEP** | Picks the venues in the studio; answering it unlocks the page. |
| 126 | Step 4 | Do you like doing these thought leadership pieces? (4 stops) | contentComfortLevel | PLAN (sprint, visibility calibration), Marketing Plan "low comfort" actions, coach notes | action, tone | **KEEP** | Sizes content actions. |
| 127 | Step 4 | How do you feel about being open about your job search on LinkedIn? | linkedinOpennessComfort | NONE (written by two forms, read by none) | none | **DROP** | Near-duplicate of the public-visibility question above. |
| 128 | Step 4 | How much do you use LinkedIn? | linkedinUsageFrequency | LinkedIn page (non-null unlocks the post generator) | function (unlock) | **UNCLEAR** | Value never used, only "answered"; use a plain unlock instead. |
| 129 | Step 4 | Is your LinkedIn profile up to date? | linkedinProfileUpToDate | Interim launch plan checkbox | action | **UNCLEAR** | One plan checkbox; better inferred by prompting the update. |
| 130 | Step 4 | How comfortable do you feel letting your network know you are looking for a role? | networkComfortLevel | Network page, STRAT | function, tone | **MERGE** | Fourth ask of the same question. |
| 131 | Step 4 | What concerns do you have about reaching out to your network? (7 options) | networkingConcerns | Network page outreach plan card, STRAT | function, tone | **KEEP** | Shapes the outreach plan. Asked again by the selector on the Network page. |
| 132 | Step 4 | New networking outreach messages per week you are aiming for (optional) | networkingOutreachTargetPerWeek | NONE (completeness check only) | none | **DROP** | The Network page never reads it; real outreach is logged. |
| 133 | Step 4 | Have you networked or been referred into a job before? (+ How recently?) | hasBeenReferredBefore, referralRecency | COACHV only (coaching notes) | none for the member | **UNCLEAR** | Coach display only. |
| 134 | Step 5 | How comfortable are you negotiating comp and terms once you get an offer? (4 stops) | negotiationComfort | LEARN (curated-content video ranking only) | function | **MERGE** | Copy says it shapes suggested skills; only the video order changes. Merge with the other comfort sliders. |
| 135 | Step 5 | How comfortable are you in interviews? (4 stops) | interviewComfort | LEARN (videos), Interview Prep comfort check | function | **MERGE** | Same field as the Interview Prep comfort check. |
| 136 | Step 5 | Do you want Health/Dental/Vision insurance? | wantsHealthDentalVisionInsurance | Pay page ask list (benefitsAsks) only | function | **MERGE** | Nine benefit fields only print a list on the Pay page; fold into one multi-select. |
| 137 | Step 5 | Do you want disability insurance? | wantsDisabilityInsurance | Pay page ask list only | function | **MERGE** | Same as above. |
| 138 | Step 5 | Do you want a 401k/retirement plan? | wants401kMatch | Pay page ask list only | function | **MERGE** | Same as above. |
| 139 | Step 5 | How many weeks of PTO do you expect? (optional) | ptoWeeksExpected | Pay page ask list only | function | **UNCLEAR** | A number nothing compares to postings. |
| 140 | Step 5 | How many days per week would you like to work from home? (0-5) | remoteDaysPerWeekDesired | Pay page ask list only | function | **MERGE** | Same fact as work-location preference (hybrid). |
| 141 | Step 5 | What is the minimum comp you are able to take? (again) | targetCompMin | see Step 1 | data | **MERGE** | Same field as Step 1. |
| 142 | Step 5 | How many weeks of paid parental leave do you expect? (optional) | paidParentalLeaveWeeksExpected | Pay page ask list only | function | **UNCLEAR** | A number nothing compares to postings. |
| 143 | Step 5 | Do you want professional development reimbursement? / commuter benefits? / a gym membership? | wantsProfessionalDevReimbursement, wantsCommuterBenefits, wantsGymMembership | Pay page ask list only | function | **MERGE** | Three more yes/no benefit toggles for the same list. |
| 144 | Step 6 | Are you willing to take unpaid board positions to fill in resume gaps, keep skills current, and build new experience? | boardAdvisoryWillingness | MATCH (work-type: advisory roles on the board), interim work page | function, outcome | **KEEP** | Turns on advisory roles. Also asked on the interim work page. |
| 145 | Step 6 | Are you already doing independent or part-time work, or have you before? (consulting, expert network, fractional, part-time, each with a status) | independentWorkExperience (Json), triedPartTimeOrConsulting | NONE for the values (null check in action-verification) | none | **DROP** | Four sub-questions with no reader. |
| 146 | Step 6 | How much have you been networking? (Not much / Some / A lot / I cannot do more) | networkingLevel | PLAN (visibility calibration, activity reconciliation prompt) | tone | **DROP** | Real outreach is logged; the self-report only seeds one coach note. |
| 147 | Step 6 | Have you used your time to learn new skills? | learnedNewSkillsLevel | COACHV (coaching notes), null check | none for the member | **UNCLEAR** | Coach display only. |
| 148 | Step 6 | Have you tried Executive Coaching? | triedExecutiveCoaching | REPORT (market-reality-sections coach-need score) | function | **UNCLEAR** | Only raises or lowers one coaching recommendation. |
| 149 | Step 6 | Have you connected with recruiters? (+ how many) | connectedWithRecruiters, recruiterConnectionCount | REPORT (same recommendation); count: display only | function | **UNCLEAR** | Count has no reader; the yes/no moves one recommendation. |

### https://launchyournextchapter.com/dashboard/what-i-need

What I Need

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 150 | items | Rate 24 work-value statements (Not important / Somewhat / Important / Essential), e.g. "Work that uses my abilities fully" | WhatINeedResponse.itemRatings (Json) | work-profile-load (per-job working-style read on the job board), people-like-you; MATCH none | function | **MERGE** | Another culture and values instrument; merge with culture fit and the 10 this-or-that questions. 24 questions for a read-only comparison. |
| 151 | rank | Rank the six work-value domains (Achievement, Independence, Recognition, Relationships, Support, Working Conditions) | WhatINeedResponse.domainRank | Pay page (domain order) | function | **MERGE** | Same as above. |

### https://launchyournextchapter.com/dashboard/marketing-plan

My Marketing Plan (working tool; venues and comfort come from Search Strategy step 4)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 152 | Studio | Pick venue, title/angle, reason; request an article topic; generate ideas | saved drafts | LLM generation inside the studio | function | **KEEP** | Tool inputs, not profile questions. |
| 153 | Narrative | Core narrative and hard questions edits | CandidateNarrative rows | Interview Prep, apply-kit, recruiter report | function | **KEEP** | Working document. |

### https://launchyournextchapter.com/dashboard/strengths

Why hire me

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 154 | view | No inputs. Read-only view of strengths evidence. | n/a | n/a | n/a | **KEEP** | Output page. |

### https://launchyournextchapter.com/dashboard/how-i-perform

How I Perform

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 155 | items | 40 agreement items in 5 dimensions (Execution, Judgment, Composure, Influence, Integrity), 4-point scale | PerformanceAssessmentResponse (scores per dimension) | REPORT (dossier competencies, strengths-load), PLAN (activation), recruiters via Candidate+ dossier | outcome | **KEEP** | Feeds the dossier traits recruiters see. Not used by job matching. Integrity score is not read anywhere (OPEN_ITEMS). |

### https://launchyournextchapter.com/dashboard/skills-assessment

Skills Inventory

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 156 | questionnaire | Select up to N strengths where you truly stand out | topStrengths | REPORT (dossier, self-awareness), apply-kit, skill-gap suggestions | outcome | **KEEP** | Dossier evidence. |
| 157 | questionnaire | Select up to N areas you are actively working on (+ in your own words) | growthAreas, growthAreasElaboration | REPORT (dossier self-awareness), skill-gap suggestions, reference breakdown, LEARN | outcome | **KEEP** | Drives the learning gaps. |
| 158 | questionnaire | How confident are you in your core job function? (4 stops) | functionSkillConfidence | REPORT (dossier competencies) | outcome | **KEEP** | Dossier input. |
| 159 | questionnaire | How confident are you in your AI skills? | aiFlexibilityLevel | LEARN (learning plan, AI training tiers, skill gaps), dossier | function | **KEEP** | Sizes AI learning. |
| 160 | questionnaire | How confident are you in your management skills? (people managers only) | managementSkillConfidence | REPORT (dossier, work profile, market-reality-report) | outcome | **KEEP** | Only asked of people managers. |
| 161 | Skills you have | Skills you have (confirm/add) | confirmedSkillsHave | MATCH (skills read in every job), LEARN, member profile | data, outcome | **MERGE** | Overlaps resume keywords and tools. |
| 162 | Skills you need | Skills you need to build | skillsToBuild | LEARN (learning plan, videos), COACHV (coach matching), pivots | function | **KEEP** | Drives Learn. Also asked on the Skills & Behavioral Assessments hub. |
| 163 | Skills matrix | Skill level per skill (and remove a skill) | skillLevels (Json) | MATCH (job-match, job-fit-bucket), strengths | outcome | **KEEP** | Used per job. |
| 164 | Tools | Tools you use (tick the ones you work with) | confirmedSkillsHave / tools, toolsConfirmedAt | MATCH (20% of the tuned meter; checked against job tools) | data, outcome | **MERGE** | Same list family as skills you have. |
| 165 | Work style | Ten this-or-that questions: Which day leaves you with more energy? / Which do you enjoy more? / Where do you add the most? / Which week suits you better? / How do you like to get work done? / Starting something new, you would rather ... / Next, would you rather ... / Right now in your career you want ... / Given the choice, you would take ... / Where would you rather spend your day? | CandidateProfile.workStyleAnswers (Json) | MATCH (workStyle dimension, 20% weight in "why this fits"), pivots, work profile | outcome | **KEEP** | Cheapest culture signal; the model to merge the other culture instruments into. |

### https://launchyournextchapter.com/dashboard/skills-assessments

Skills & Behavioral Assessments (hub)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 166 | hub | Skills I want to build (select) | skillsToBuild | LEARN, COACHV | function | **MERGE** | Same field as "Skills you need to build" on the Skills Inventory. |
| 167 | hub | Links to Skills Inventory, How I Work Best, How I Perform, What I Need, Work Interests | n/a | n/a | n/a | **KEEP** | Navigation only. |

### https://launchyournextchapter.com/dashboard/retake-assessment

How I Work Best (retake, once per 7 days)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 168 | assessment | How I Work Best: 57 agreement items plus quad blocks ("least like me") | CandidateAssessmentResponse.dimensionVectors | REPORT (dossier competencies, self-awareness vs references), work-profile-load, pivots | outcome | **UNCLEAR** | Retake page claims it keeps job matches personalized; job matching does not read the vectors, only per-job work-style read and the dossier do. |
| 169 | assessment | How would former colleagues describe you? | CandidateProfile.knownFor | MATCH (cover note, apply-kit, discover card), share pages, references, great-employers | function, outcome | **KEEP** | Reused in applications. |

### https://launchyournextchapter.com/dashboard/early-career

Early career plan

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 171 | education | School / Degree / Major or field of study / Graduation year | EducationEntry | PLAN (early-career plan, major to role), learning plan | function | **MERGE** | Same four fields asked at onboarding and Profile. |
| 172 | major picker | Your major (select) then pick a role | targetRoleType (via setTargetRoleFromMajor) | MATCH, VIC, STRAT, LEARN | data, outcome | **MERGE** | Another way to answer target role. |
| 173 | checklist | Checklist items: mark done / not done | EarlyCareerChecklist progress | PLAN (progress), home module | function | **KEEP** | Progress tracking, not personalization. |

### https://launchyournextchapter.com/dashboard/got-hired

Got hired

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 174 | bounty | Company name, Role title, Start date, Testimonial, Offer letter upload | BountyClaim | ADMIN (offer bonus review) | outcome | **KEEP** | Outcome claim; the member gets the bonus. |
| 175 | outcome | What kind of role is this? / How did it come together? / Start date / City, State, remote / Previous yearly base pay (optional) / New yearly base pay (optional) / Level retained | HireOutcome | REPORT (outcome and pay-retention reports, segments), company portal hub | outcome | **KEEP** | Outcome data. No effect on the member. |
| 176 | outcome | Last day you worked | CandidateProfile.lastJobEndedAt | REPORT (search playbook duration bucket), benefits page deadlines | function | **KEEP** | Drives benefits timing. |
| 177 | outcome | Age range (optional) | CandidateProfile.ageBand | ADMIN (outcome segments) | none for the member | **UNCLEAR** | Reporting segment only; sensitive. |
| 178 | sharing | Share my outcome with {employer seat} (toggle) | employer outcome sharing | Employer scorecard | outcome | **KEEP** | Consent toggle. |

### https://launchyournextchapter.com/dashboard/in-work

Staying in work (manage-my-career journey)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 179 | review settings | Review cadence, anchor month, next review date, review prompts on/off | InWorkProfile (upsert) | EMAIL (in-work-review-emails cron), PLAN | action | **KEEP** | Schedules reminders. |
| 180 | wins | Win: what you did / result / who benefited / date | InWorkWin | PLAN (prep checklist, review email), staff programs | function | **KEEP** | Working record. |
| 181 | prep | Review prep: checklist, wins, goals, the ask, evidence, up to 5 manager questions | InWorkPrep | workspace, review email | function | **KEEP** | Working record. |
| 182 | promotion plan | Target level, gap items, stretch scope, decider, 30/60/90 plans, visibility items | InWorkPromotionPlan | workspace | function | **KEEP** | Working record. |
| 183 | feedback | Feedback: source, category, date, what was said, action items | InWorkFeedback | workspace, sprint link | function | **KEEP** | Working record. |
| 184 | outcome | Review outcome: date, rating, raise received and percent, promoted, new title, notes, follow-ups | InWorkOutcome | workspace, review email | function | **KEEP** | Working record. |

### https://launchyournextchapter.com/dashboard/review-prep

Review prep (raise or promotion conversation)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 185 | conversation | What is the conversation? / Your ask, dollars a year / Or a title or level / Date, if you have one / three reasons (a result with a number) / Your walk-away | CareerConversation | PLAN (engagement-data), page | function | **KEEP** | Working record; ask amount also compared with pay benchmarks. |
| 186 | outcome | Record how the conversation went | CareerConversation.outcome | page | function | **KEEP** | Working record. |

### https://launchyournextchapter.com/dashboard/interview-prep

Interview prep

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 187 | job description | Paste the job description or its URL | CandidateProfile.activeJobDescription | Interview Prep tabs (practice, culture questions), LLM prompts | function | **KEEP** | Working input. |
| 188 | comfort check | How comfortable are you telling your story / in interviews / is your elevator pitch ready? (3 sliders) | storyComfort, interviewComfort, elevatorPitchReady | LEARN (storyComfort: build-learning-plan, videos), interviewComfort also asked on Search Strategy step 5; elevatorPitchReady: display only | function | **MERGE** | interviewComfort is asked twice; pitch-ready has no reader. One comfort check is enough. |
| 189 | story | Core statement edits, story adaptations, practice answers, tough-question text, thank-you note inputs | narrative / interview response rows | LLM feedback, dossier proof points | function | **KEEP** | Working tools. |

### https://launchyournextchapter.com/dashboard/privacy

Privacy (includes "Your situation", email options, sharing). Journey change dialog also edits journey and stage.

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 190 | Connected accounts | Connect or disconnect Google (Gmail and Calendar) | Google tokens on the profile | PLAN (auto-tracked applications, meetings, activity), EMAIL sync | function | **KEEP** | Turns on automatic activity tracking; makes some self-report questions unnecessary. |
| 191 | Privacy tier | Who can see your profile? (Public / Semi-Public / Private / Stealth / Locked) | privacyTier | COACHV (talent search, candidate cards, share, community), 50 files | outcome | **KEEP** | Core consent control. Also on complete-profile. |
| 192 | Your situation | What is going on (11 situations, select) | journey | MENU, PLAN, EMAIL, VIC | function, action | **MERGE** | Same fact as the onboarding card and the Still searching check-in. |
| 193 | Your situation | Where you are (Exploring / Preparing / Applying / Interviewing / Offer ...) | journeyStage | MENU, PLAN, EMAIL | function, action | **MERGE** | Same fact as the check-in dialog and "When do you want to start applying". |
| 194 | Your situation | What is behind the move? | journeyDetails.moveDriver | PLAN | action | **MERGE** | Same as onboarding row. |
| 195 | Your situation | When do you expect to be back? / Your one-line offer / Days a week open / Current engagement ends | journeyDetails.returnDate, .offering, .openDays, .engagementEnds | PLAN (engagement) | action | **MERGE** | Same four as onboarding for those journeys. |
| 196 | Your situation | How actively are you looking? | searchIntensity | PLAN, VIC, REPORT | action, tone | **MERGE** | Same as onboarding row. |
| 197 | Who can see your situation | No input: read-only list of what each school, program or partner affiliation can see | n/a | display of affiliation visibility rules | none | **KEEP** | Explains visibility; there is no control here, so it is not a question. |
| 198 | Confidential Search Mode | Confidential Search Mode (on/off, with confirm when turning off) | confidentialSearchMode | EMAIL (neutral subjects), COACHV (recruiter visibility), community, 79 files | outcome | **KEEP** | Defaulted by journey at onboarding. Overlaps the public-disclosure comfort question. |
| 199 | Employer & recruiter matching | Let recruiters find me (opt-in) | recruiterDatabaseOptIn | COACHV (recruiter search), Candidate+ loader, job board | outcome | **KEEP** | Also offered as a form on the job board. |
| 200 | My recruiters | Share with this recruiter firm (per connection) / disconnect | IntakeConnection sharing flag | recruiter firm views | outcome | **KEEP** | Per-firm consent. |
| 201 | Resume Book | Include my resume in the resume book (opt-in) | resumeBookOptIn | recruiter resume book, action-verification | outcome | **MERGE** | One of four places this opt-in appears. |
| 202 | Leaderboard | Appear on the leaderboard (opt-in) and how I appear (display mode) | leaderboardOptIn, leaderboardDisplayMode | stats page leaderboards | outcome | **KEEP** | Consent control. |
| 203 | Email options | Notification tier (Full / Essentials / Minimal) | notificationTier | EMAIL (daily nudge, Friday check-in, digests, win-back) | function | **KEEP** | Directly sets email volume. |
| 204 | Email options | When are you most ready to take action? (Morning / Plan at night, act in the morning / Midday / Evening / It varies) ("Vic's daily action email arrives in this window") | CandidateProfile.actionWindow | NONE (no email or cron reads it) | none | **DROP** | The promise is not kept; also listed as orphan in docs/OPEN_ITEMS.md. |
| 205 | Support network | Invite a supporter: Their name, Their email (see Supporters) | SearchSupporter rows | EMAIL (supporter digest) | function | **KEEP** | See https://launchyournextchapter.com/dashboard/supporters. |
| 206 | What they see / share links | Who is this link for? / Where are you in the process with them? / Anything extra to include? / Link expires after | ProfileShare rows | public share page | outcome | **KEEP** | Creates a shareable profile link. |
| 207 | Coach access | Grant or revoke coach access to dossier and notes | coachDossierConsentedAt | COACHV | outcome | **KEEP** | Same switch as onboarding consent. |
| 208 | Account | Deactivate account / Delete account (typed confirmation) / download my data | account state | n/a | outcome | **KEEP** | Required controls. |

### https://launchyournextchapter.com/dashboard/recruiter-report

Recruiter report

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 209 | report | Prepared for (name field) | report header text | printed report | function | **KEEP** | Personalizes the printout. |
| 210 | report | Approve or edit positioning statement | positioningStatementText, positioningStatementSetAt | recruiter report, apply-kit, resume walkthrough | outcome | **KEEP** | Member-approved text shown to recruiters. |
| 211 | report | Approve or edit self-awareness paragraph | selfAwarenessText | recruiter report, dossier | outcome | **KEEP** | Member-approved text shown to recruiters. |

### https://launchyournextchapter.com/dashboard/supporters

Supporters

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 212 | invite | Their name / Their email | SearchSupporter rows | EMAIL (supporter-digest) | function | **KEEP** | Sends supporters a digest. |

### https://launchyournextchapter.com/dashboard/coaching-match

Coaching match (members shopping for a coach)

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 213 | preferences | Coach gender preference | coachGenderPreference | COACH matching (shortlist filter) | outcome | **KEEP** | Filters the shortlist. |
| 214 | preferences | Communication style (Direct, tell me straight / Context first, walk me through the reasoning) | coachCommunicationStylePreference | COACH matching (boost for direct) | outcome | **MERGE** | Fifth coaching-style question (push style, pace, intake accountability). |
| 215 | preferences | Coach language preference | coachLanguagePreference | COACH matching | outcome | **KEEP** | Filters the shortlist. |
| 216 | preferences | Coach timezone preference | coachTimezonePreference | COACH matching | outcome | **KEEP** | Filters the shortlist. |
| 217 | style | What do you want from a coach? (rate several statements 1-4: pushed, supported, held accountable ...) | CoachingStyleResponse.itemRatings, .topStyles | COACH matching (style score) | outcome | **MERGE** | Another coaching-style instrument; same family as the push-style question. |

### https://launchyournextchapter.com/dashboard/find-my-job

Find a job (board tuning and "What we know about you")

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 218 | What we know about you | No questions. 7 signals shown (city, title, function, tools, industries, work setup, clearance) with "Add"/"Edit" links to other pages; meter weights 25/20/10/20/15/10/0 | derived from the profile | display of MATCH inputs | data | **KEEP** | Good model for the strip. Function link points to a Profile section that cannot edit function (it says "Edit on Search Strategy"); clearance weighs 0. |
| 219 | Add your city | City, State (inline) | currentCity, currentState, metroArea | MATCH | data, outcome | **MERGE** | Fourth place for city. |
| 220 | Breadth | Narrow / Wide (board breadth toggle) | CandidateProfile.boardBreadth | MATCH (search-breadth), EMAIL (job emails use Narrow unless Wide) | outcome | **KEEP** | Real control over the board and the emails. |
| 221 | Sectors | Employer sector toggles (turn a sector off and its jobs leave the board and emails) | hiddenEmployerSectors | MATCH, EMAIL | outcome | **KEEP** | Also on Search Strategy step 1. |
| 222 | Pass on a job | Why pass? (12 reasons: Company, Industry, Skills do not fit, Title, Level, Pay, Location, Ghost job, Too good to be true, Red flags, Already applied elsewhere, Other) + note | JobDismissPreference, JobPostingFlag, TrackedJob status | MATCH (hide company, move similar down, pay floor), admin ghost-job list | outcome | **KEEP** | Teaches the board from behavior; no profile form needed. |
| 223 | Pass on a job | After repeated passes: Hide all {industry/title/level/location}? (Hide / Keep) | JobDismissPreference.action | MATCH | outcome | **KEEP** | Self-tuning prompt. |
| 224 | Work type | Work type toggle (Full-time / Part-time / Contract / Advisory) | CandidateProfile.jobBoardWorkTypes (empty means derived from onboarding answers) | MATCH (work-type.ts board filter) | outcome | **MERGE** | Overlaps fractional-interest, board-advisory and the fractional journey; one "what kinds of work" question. |
| 225 | Filters | Great employers, Seniority, Function, Past jobs, Requirement filters | URL parameters only (not saved) | board query | outcome | **KEEP** | Session controls; none stored. |
| 226 | Recruiter visibility | Let recruiters find me (form on the board) / Resume book opt-in form | recruiterDatabaseOptIn, resumeBookOptIn | COACHV | outcome | **MERGE** | Same opt-ins as Privacy. |
| 227 | Add a job | Paste a job URL / mark applied (date, details) / company watchlist name | TrackedJob, CompanyWatchlist | tracker, alerts, activity counts | function | **KEEP** | Tool inputs; these make the application counts real. |

### https://launchyournextchapter.com/dashboard

Home: check-in and journey-change dialogs and prompts

| # | Where | Question (user-facing wording) | Stores | Read by | Changes | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 228 | journey check-in | Still searching? (Yes, still searching / I have an interview / I got an offer / I am not looking right now / [more] I am ready to start applying / I was laid off / I started a new job) | journey, journeyStage (applyJourneyChange), SearchCheckIn answers | MENU, PLAN, EMAIL (daily email cron skips non-searchers) | function, action | **KEEP** | The right shape for a status question. Same fact as onboarding timing and the Privacy situation selector. |
| 229 | Saturday email | Still searching? One-click answers in the email (Still searching / Managing my career / Got an offer) | SearchCheckIn.answer; moves journey via /api/checkin | EMAIL (job-search-daily and fresh-job-alerts crons skip non-searchers), PLAN | function, action | **MERGE** | Third place for "am I still searching" (in-app dialog, Privacy selector, this email). |
| 230 | passive to active | Has anything changed? (Opened up / Not yet / Do not ask again) | confidential mode state, passiveToActivePromptDontAskAgain | Home prompt logic | function | **MERGE** | Second "has anything changed" prompt next to the journey check-in. |
| 231 | mood | How are you feeling today? (mood options) | DailyCheckIn (mood), CheckInPrompt.response | on-screen reply, COACHV (pre-session brief), PLAN (sprint credit) | tone, action | **KEEP** | Gives an immediate reply. |
| 232 | daily action | Great, that is your action for today (Yes / Not today) for applications or outreach | CheckInPrompt.response | daily check-in throttling only | action | **KEEP** | Not a profile fact; an action nudge. |
| 233 | stalled search | Stalled search prompt (Acknowledge / Do not ask again) | stalledSearchPromptDontAskAgain | Home prompt logic | action | **KEEP** | Nudge, not a profile fact. |
| 234 | work style | WorkStylePrompt: ten this-or-that questions (shown on Home and Pivot paths) | workStyleAnswers | MATCH, pivots | outcome | **KEEP** | Same questions as Skills Inventory work style. |
| 235 | insight | Review a former job, or describe a company's culture | JobReview / CultureSurvey | company pages | none for this member | **UNCLEAR** | Data contribution, not personalization; nothing changes for the member. |
| 236 | retune | RetuneMoment: shows matches before and after a profile change | MemberMatchSnapshot | display | data | **KEEP** | Not a question; the proof that an answer changed something. |
