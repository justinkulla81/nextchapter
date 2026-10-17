# Personalization audit: what already exists in the code

Audit date 2026-10-17. Read-only pass over `main` (HEAD 24c1c5f9) plus the unmerged branch `origin/claude/compassionate-edison-fkfdu5`. Nothing was changed except this file.

## Summary

- **Time-based personalization already exists, and it is bigger than the owner may think.** Three separate rules react to elapsed search time or lack of progress: `SEARCH_GATES` (weeks 3, 6, 9, 13 add plan steps), `gateMove` in `engagement.ts` (a card at week 3+ that changes with the pattern: applications but no interviews, or interviews but no offers), and the per-journey search playbook (weeks 4, 12, 20, 27, 40 and so on). A fourth, `evaluateStalledSearchPrompt`, fires on a different test (two or more weeks of hitting both goals with no interviews). "Week 12 with no interviews: widen the search" is literally in the playbook text and in the gates, but nothing changes the profile, the job matching or the search scope. It only changes wording and plan steps.
- **Most of it is wired to real data, but it is easy to miss on Home.** The Home note slot shows one card, and `got_hired` (weeks 2+, no bounty claim) outranks the playbook, so the playbook rarely shows. The engagement card is separate and does show. Production has 0 JourneyEvent rows, so everything keyed on events falls back to `journeyStageChangedAt`, then `createdAt` or first application. That works for the engagement and plan rules and mostly works for the playbook.
- **Mood and check-ins exist but change almost nothing.** `DailyCheckIn` (four moods) is asked up to 3 times a week. A "Stuck" answer shows one line and a link to the support page. The low-sentiment detector `getSentimentAlert` is read only by coach and admin screens, never by the member's plan, tone or Home.
- **Dossier traits, Candidate+ and effort minutes are real and live**, but the nine traits render only on `/dashboard/stats`, not on Home. Candidate+ requirements do show on Home (Unlocks module, recruiter goal card).
- **Skills mapping and career exploration are real code but data-dependent.** `CourseSkill` is empty in production, so "a course for this skill gap" returns nothing. Pivot paths work from the in-code pivot map and O*NET tables when loaded. The unmerged branch adds career story, "What would it take" and "Thinking about a pivot" (stance and feelings history), which is the only place a member's feelings about change are kept over time.

---

## 0. Answer to the headline question: is there any rule that reacts to elapsed time or lack of progress?

**Yes. Four, plus one email family. None of them changes the member's search scope or job matching; they change plan steps and message text.**

| # | Rule | File | Trigger | What it changes | Wired to real data? |
|---|---|---|---|---|---|
| 1 | `SEARCH_GATES` | `src/lib/journey/plan.ts` (`gateItems`, called from `shapePlan`) | stage is APPLYING or INTERVIEWING and `weeksInStage` >= 3, 6, 9, 13. Gates stack. | Adds plan steps to the weekly plan (the weekly sprint): week 3 Résumé Fixer; week 6 widen targets, look at interim work; week 9 book a coach, ask a hirer to critique your pitch; week 13 test an adjacent lane, review runway. | Yes. `weeksInStage` = weeks since `journeyStageChangedAt ?? createdAt` (`engagement-data.ts`). Does not need JourneyEvent. Casual searchers get the clock halved in the engagement card but not in `gateItems`. |
| 2 | `gateMove` (the "stalled" half of the engagement card) | `src/lib/journey/engagement.ts` (`searchPattern`, `gateMoveFor`); loaded by `engagement-data.ts`; rendered by `src/components/dashboard/EngagementCard.tsx` | stage APPLYING or INTERVIEWING and no offer. Pattern is NOT_STARTED (nothing logged), APPLYING_NO_INTERVIEWS, or INTERVIEWS_NO_OFFERS. Min 3 weeks (`MIN_WEEKS_FOR_GATE`). | Headline "N weeks in, applications but no interviews". Week 3 to 5: run the Résumé Fixer. Week 6 to 8: widen targets, look at interim work. Week 9+: find a coach. Interviews but no offers: interview practice. Not started: "send your first five messages" (after week 1, not for casual). Casual searchers: weeks halved and "make one change, not a full push". Tone line from `coachingStylePreference` (`toneLine`). Also feeds the weekly plan (`engagementPlanItems`, goes first) and the weekly emails. | Yes. Counts are real: `jobPosting.appliedAt`, `interviewLandedAt`, `offerReceivedAt`, `outreachLog`, all since the stage began. Only as good as members logging interviews. |
| 3 | Search playbook | `src/lib/journey/search-playbook.ts`; loader `src/lib/dashboard/search-playbook-data.ts`; card `src/components/dashboard/search-playbook/SearchPlaybookCard.tsx`; shown on Home | Stage in `ACTIVE_SEARCH_STAGES` (APPLYING, INTERVIEWING, OFFER). Clock: laid-off members count weeks since `lastJobEndedAt`; everyone else weeks since search start (`pickSearchStart`: earliest JourneyEvent into an active stage, else `journeyStageChangedAt`, else first `appliedAt`). Milestones by journey: LAID_OFF weeks 4, 12, 20, 27, 40; EXPLORING_MOVE 4, 8, 12, 20; PROMOTION 4, 8, 12, 20; CAREER_CHANGE 4, 12, 20, 30; RETURNING 4, 8, 12, 20; NEXT_ACT 8, 16, 24; STUDENT_NEW_GRAD 2, 4, 8, 12, 20. | A card: current milestone title, summary, 2 to 3 linked actions, one evidence line. LAID_OFF week 12 "change what you are doing: widen the search, add one adjacent title and industry"; week 27 "long-term group, not a personal failure"; week 40 "choose whether to keep your old level or build toward a new field" (links to Learn). | Yes, no metered calls. **Does not look at results** (applications, interviews). It is purely elapsed time. With 0 JourneyEvent in production it falls back to `journeyStageChangedAt`; if that is null and the member never logged an application the clock is null and the card does not show. |
| 4 | Stalled-search prompt | `src/lib/dashboard/stalled-search-prompt.ts`; card `StalledSearchPromptCard.tsx`; actions `recordStalledSearchPromptShown`, `respondToStalledSearchPrompt`, `recordStalledSearchSuggestionClicked` in `src/app/dashboard/actions.ts` | The last 2 or more completed weeks (up to 4) each hit BOTH targets (applications >= `getRecurringTargetCount('JOB_APPLICATION_SUBMITTED') ?? 3` and outreach >= `?? 2`) AND zero interviews landed or calendar-detected since. Throttle 14 days (`stalledSearchPromptLastShownAt`), permanent opt-out `stalledSearchPromptDontAskAgain`. Tier 1 at 2 to 3 weeks, tier 2 at 4+ weeks. | A Home note: "You're doing the work, it's not converting yet" (tier 1) or "a full month with no interviews" (tier 2). Buttons: review fit of applications (find-my-job), reconsider target role (search-strategy), interim work, coach. Highest priority prompt on Home after the coaching form. | Yes, real timestamped counts. Fires only for members who are hitting targets, so it will rarely fire. It is the opposite case from the owner's "no progress" (a member doing nothing is not stalled here; they get gate rules 1 and 2). |
| 5 | Passive-to-active ("Has anything changed?") | `src/lib/dashboard/passive-to-active-prompt.ts`; card `PassiveToActivePromptCard.tsx`; field `passiveToActivePromptLastShownAt` | Only for Confidential Search Mode. Triggers: DOSSIER_COMPLETE, FIRST_APPLICATION_LOGGED, WEEKLY_ACTIVITY_DOUBLED, PERSONA_CHANGED_TO_LAID_OFF, SIXTY_DAY_CHECKIN. 30-day throttle. | A Home note asking whether they are ready to go active. Prompt only, never switches the mode. | Yes. This is not a "no progress" rule; it is a "more activity" rule. |
| 6 | Weekly emails | `src/app/api/cron/candidate-email-dispatch/route.ts` and `src/lib/email/dispatch/run-*.ts` (gap nudge, midweek check-in, daily nudge, search check-in, finish line, win-back) | Day-of-week schedule from `CandidateEmailSchedule`; gap nudge compares this week's points to the target; win-back at 21, 42, 63 days of inactivity (`src/lib/winback/sequence.ts`). Casual members are excluded from push emails (`NOT_CASUAL_WHERE` in `src/lib/journey/intensity.ts`). | Email copy by journey. Win-back "one small thing" by journey. | Yes. Win-back is the only elapsed-time rule keyed on inactivity; the others are weekly-cycle rules. |
| 7 | Auto-advance | `src/lib/journey/auto-advance.ts`, cron `/api/cron/landed-to-managing` | 90 days after LANDED. | Moves the member to Managing your career and swaps plan, menu and emails. | Yes. Time-based, but about success, not stall. |

**Not found anywhere:** a rule that (a) automatically widens the saved search scope, relocation radius, target titles or industries because of elapsed time; (b) raises the number of recommended actions or the weekly point target because progress is low; (c) suggests a pivot or opens Pivot paths because of a stall; (d) reacts to the market grade falling or staying low. Everything above is advice text or plan steps. The weekly points target is a fixed ramp `[60, 75, 90, 105, 120]` by week number (`src/lib/weekly/action-effort.ts`, `WEEKLY_POINTS_RAMP`), halved for casual members (`getPace`), and does not rise on a stall.

### Closest things to "widen" and "pivot" that are not time-driven

- Playbook milestone text links to `/dashboard/search-strategy` (widen) and `/dashboard/learning` (new field). Links only.
- `src/lib/reports/career-pivoter-redirect.ts` returns pivot-framed copy when the probability grade is F ("this is a targeting problem, not a volume problem"). Shown in the Market Reality report (`src/lib/reports/market-reality-sections.ts`), not on Home.
- `PivotBoardBanner`, `PivotPathsTeaser`, `MarketSizeBlock` link to Pivot paths from the job board and market pages. Always available, never triggered by time.
- On the unmerged branch (section 7): `engagement.ts` adds a week-6 relocation widening (see below). That is the nearest existing "expand the search by time" rule.

### Signals that exist today and could drive a time/progress rule

All are real columns or computed values.

| Signal | Where it lives | Notes |
|---|---|---|
| Days/weeks since stage began | `CandidateProfile.journeyStageChangedAt` (fallback `createdAt`); `weeksInStage` in `EngagementSignals` | Resets on a stage change. The "Nothing yet / still searching" check-in answer does not reset it. |
| Days/weeks since journey began | `CandidateProfile.journeyChangedAt` | Used on the branch for plan week. |
| Weeks since last job ended | `CandidateProfile.lastJobEndedAt` | Only used for LAID_OFF playbook clock. |
| Search start | `pickSearchStart()` (JourneyEvent, else stage change, else first application) | 0 JourneyEvent in prod, so fallbacks matter. |
| Applications count (total, week, since stage) | `jobPosting.appliedAt` | Used by stalled prompt, engagement, dossier gate, `getWeekToDateActivity`. |
| Interviews landed | `jobPosting.interviewLandedAt`; `trackedCalendarEvent` with eventType INTERVIEW | Self-reported plus calendar-detected. |
| Offers | `jobPosting.offerReceivedAt` | |
| Outreach / networking count | `outreachLog` (incl. channel MEETING); `trackedEmailActivity` | |
| Applications per conversation, 28-day window with trend | `src/lib/jobs/search-efficiency.ts` (`computeSearchEfficiency`, `loadSearchEfficiency`) | States NOT_ENOUGH_DATA, NO_CONVERSATIONS, STRONG, TYPICAL, HIGH. Rendered by `SearchEfficiencyCard` on find-my-job. **Not used by any plan or Home rule.** Best existing "no progress" metric. |
| Effort minutes (lifetime) | `getLifetimeEffortMinutes` (`src/lib/scoring/effort-minutes.ts`): sum of earned points across all `WeeklySprint.committedActions`; 1 point = 1 minute | Candidate+ target 480 (`DOSSIER_EFFORT_MINUTES_TARGET`), admin-overridable via `effortMinutesTargetOverride`. |
| Weekly points vs. target | `computeWeeklyProgress` (`weekly-engines.ts`), `onTrack` on Home | Target is fixed by week number; `onTrack` is computed on Home but only passed to the sprint card. |
| Weekly goal streak | `computeCurrentSprintStreak`; activity streak `currentStreak` / `refreshActivityStreak` | Candidate+ alternate path = streak. |
| Week number of account | `getCandidateWeekNumber` = count of prior `WeeklySprint` rows + 1 | Not elapsed time: a member who skips weeks (no sprint row) has a lower week number. |
| Market Reality grade, weekly | `computeProbabilityGrade` (`src/lib/scoring/market-reality/probability.ts`), `MarketRealitySnapshot` per week (cron `/api/cron/market-reality-snapshot`, Mondays 20:20 UTC), weekly calibration log (`calibration.ts`, band cross after 3 consecutive weeks) | Grade band A to F. Trend history available. Only consumer on Home: `SuccessSprintCard` adds a resume-improvement task when grade is not A. |
| Search intensity / casual | `searchIntensity`, `jobSearchDifficultyLevel`, `isCasuallySearching` | Halves pace and gate clock. |
| Mood history | `DailyCheckIn` (STUCK, GETTING_THERE, MOVING, FIRED_UP), `getMoodHistory`, `getSentimentAlert` (14-day average < 30 or declining trend) | Not wired to member-facing behaviour. |
| Check-in prompt log | `CheckInPrompt` (kind, shownAt, response incl. mood value) | |
| Last journey check-in answered | `journeyCheckedAt` | |
| Journey, stage, move driver, graduation, return date | `journey`, `journeyStage`, `journeyDetails` | |
| Application goals | `applicationVolumeGoal` (default 15/week in check-in prompt) | |
| Targets: function, industries, comp floor, relocation | `search-strategy` fields; `openToRelocation`; `targetIndustries`; `primaryFunction`; `isPivoting` | `isPivoting` set on branch when journey = Career change. |
| Last activity (inactivity) | win-back uses last activity | 21, 42, 63 days. |
| Candidate+ status | `isDossierUnlocked` (cached): minutesMet, evidenceMet, effortMet, alternatePath | |

---

## 1. Dossier (evidence of nine traits) and Candidate+ unlock

**Nine traits** — `src/lib/dossier/evidence-traits.ts` (`buildEvidenceTraits`), signals from `src/lib/dossier/evidence-signals.ts` (`loadTraitSignals`).
- Traits: Motivation (effort minutes: 1 / 150 / 480), Thoroughness (profile sections confirmed 0 to 6), Attention to detail (tailored applications with a cover letter + work samples), Conscientiousness (consecutive weeks goal met), Helpfulness (community posts), Communication (outreach count), References (completed references), Self-awareness (references + assessments), Peak strengths (assessments).
- Levels 0 to 3: Not shown yet, Early, Emerging, Clear. Never a score, never a comparison.
- Trigger: computed on read. No writes.
- Where shown: `ProgressUnlocks` component on `https://launchyournextchapter.com/dashboard/stats` only (`traits={evidenceTraits}`). **Not on Home.** The Home Unlocks module (`src/components/dashboard/home/UnlocksModule.tsx`) shows a count of "evidence areas" (`computeDossierCompleteness` requirements met) instead, which is a different measure from the nine traits.
- What it changes for the member: display only (a message). Nothing downstream reads trait levels (no plan, matching or tone effect).
- Real data: yes (counts over existing tables). Not empty.
- Gap: two parallel dossier measures exist (nine traits vs. the six-item `computeDossierCompleteness` used for the ladder and the passive-to-active trigger). The redesign says the dossier is "evidence of the nine traits, shown as progress, never a lock", which matches the traits code but not the Home module.

**Dossier completeness / tiers** — `src/lib/scoring/dossier-unlock.ts`: `computeDossierCompleteness`, `getDossierLadderTier` (LOCKED, PREVIEW, COMPLETE, RECRUITER_INTROS, UNPOSTED_ROLES), `getModuleGateStatus`. Page: `https://launchyournextchapter.com/dashboard/portfolio` (Build Your Dossier), `https://launchyournextchapter.com/dashboard/coach-dossier`. Narrative: `src/lib/narrative/*` (core narrative, hard questions) feeds the learning page "interview skills" and the dossier.

**Candidate+** — `isDossierUnlocked` in `src/lib/scoring/dossier-unlock.ts`.
- Requirements (owner, 2026-10-16): one assessment (Operating Profile, Personality Profile or Skills) + 5 outreach messages + 5 applications (executive band: lower application target, higher outreach target in the older spec constants) + 480 minutes of lifetime effort (`DOSSIER_EFFORT_MINUTES_TARGET`). References are not required (they count toward "Candidate+ Verified", `memberTier` in `src/lib/evidence/score.ts`). Alternate path: a weekly-goal streak.
- Permanent once earned: `candidatePlusUnlockedAt`, `candidatePlusUnlockSource`; only admin revoke (`candidatePlusRevokedAt`). One-time unlock screen: `CandidatePlusUnlockLoader` in `src/app/dashboard/layout.tsx`, action `src/app/dashboard/candidate-plus-actions.ts`.
- What it changes: unlocks who-to-contact, apply kit, explain-my-gaps on jobs (`src/lib/jobs/candidate-plus-extras.ts`), a mark that recruiters see, recruiter network access, recruiter reports and `talent` discovery.
- Home: `HomeRecruiterGoalSection` in `src/app/dashboard/page.tsx` (card `RecruiterVisibilityGoalCard`) shows remaining steps from `candidatePlusSteps` (shown only until unlocked) and `UnlocksModule` shows the ladder (`src/lib/unlocks/ladder.ts`: Full job detail and Community, Dossier taking shape, Candidate+, Recruiter introductions, Unposted roles).
- Real data: yes.
- Gap: "once earned, nothing about it looks locked" is not yet true: the ladder still renders locked rungs after Candidate+.

**Effort minutes** — `src/lib/scoring/effort-minutes.ts` and `src/lib/weekly/action-effort.ts` (`getEarnedPoints`, task points). 1 point = 1 minute. Admin override `effortMinutesTargetOverride`. Feeds Candidate+, Motivation trait, weekly sprint bar.

**Overlapping badges** — `src/lib/badges/weekly-badges.ts`, `milestone-badges.ts`, `badge-notifications.ts`; shown on `https://launchyournextchapter.com/dashboard/stats`. Milestone badges: MARKET_REALITY_COMPLETE, SEVEN/THIRTY/NINETY_DAY_STREAK, COMEBACK (return after a 7+ day gap), OVER_DELIVERING_STREAK, LANDED_INTERIM_ROLE, DOSSIER_COMPLETE, REFERENCE_CHAMPION, AI_FLUENT, GAP_CLOSER, CLEANED_UP, ASKED, KNOWN, BACKED, CONSISTENT, DOCUMENTED, INSIDER, GUIDE, CONTRIBUTOR plus leaderboard badges. Overlaps with traits: CONSISTENT/streaks vs. Conscientiousness; ASKED/KNOWN vs. Communication; BACKED/REFERENCE_CHAMPION vs. References; GUIDE/CONTRIBUTOR vs. Helpfulness; DOCUMENTED/DOSSIER_COMPLETE vs. Thoroughness. A naming rule bans "Candidate+" in badge names. Weekly badge "WEEKLY_SPRINT_TARGET_HIT" is the weekly-goal signal.

---

## 2. Time (see section 0)

Summary of how each time rule appears on Home:
- Engagement card (rule 2) renders in `EngagementCard` (own Suspense, always eligible, above the weekly plan). Primary button is the gate CTA.
- Playbook (rule 3) is the sixth note candidate, below `got_hired`.
- Stalled prompt (rule 4) is second note candidate.
- Plan steps (rule 1) appear inside the weekly plan (`SuccessSprintCard`) and are chosen in `getSuggestedActions` (`src/lib/weekly/sprint.ts`, `shapePlan`).

Gaps against the owner's intent ("as a search goes on without progress, the system personalizes: expand the search, consider a pivot, do more, more actions recommended"):
- Time rules recommend but do not apply: nothing widens the stored search scope or changes what jobs match.
- "Do more": the weekly target does not rise with time; the plan list grows only through the gates (up to 8 added steps by week 13), and the stalled and engagement rules explicitly say "more of the same will not change this".
- "Consider a pivot": only at week 13 in `SEARCH_GATES` ("test a different lane") and week 40 / week 30 in the playbook text. No link to Pivot paths from the rules and no use of results to pick the moment. On the branch, pivot steps come from what the member said they are open to, not from time.
- The three time rules use different clocks: `weeksInStage` (stage change), playbook weeks (last day or search start) and stalled weeks (consecutive completed weeks). Same member can see "week 5" in one card and "week 9" in another.
- The playbook ignores results; the engagement gate ignores the journey (it applies to every journey in APPLYING or INTERVIEWING); neither reads the Market Reality grade or `search-efficiency`.
- All time rules only apply when stage is APPLYING or INTERVIEWING (playbook also OFFER). Exploring and Preparing members have no time rule except the check-in cadence.
- `weekNumber` (prior sprint rows + 1) is used for ramp and for `got_hired` (week >= 2) and is not elapsed time.

---

## 3. Mental health / how-are-you-doing check-ins

Three separate check-in mechanisms, all mounted in `src/app/dashboard/layout.tsx` (`CheckInPromptLoader`), so they appear as a corner pop-up on any dashboard page, not just Home. "Never two pop-ups at once."

1. **Daily check-in pop-up** — `src/lib/daily/check-in-prompt.ts` (`getCheckInPrompt`), `check-in-schedule.ts` (`isPromptDue`, `chooseCheckInKind`), component `src/components/dashboard/CheckInPromptDialog.tsx`, table `CheckInPrompt`.
   - Trigger: at most 3 times in 7 days, never two days running. Kind rotates (least recently asked first) among APPLY_COMMIT (if behind the weekly application goal, active search, not casual, not stalled), NETWORK_COMMIT, and MOOD (only if no check-in yet this week).
   - Mood: four buttons (Stuck, Getting there, Moving, Fired up) from `src/lib/daily/mood-labels.ts`. Saves `DailyCheckIn` (`recordMoodCheckIn` in `src/lib/daily/mood.ts`), updates `lastCheckInAt`, refreshes the activity streak and earns weekly check-in points.
   - What it changes for the member: a one-line response (`MOOD_RESPONSE`). On "Stuck", adds "A hard stretch is normal in a search" and a link to `https://launchyournextchapter.com/dashboard/support`. Nothing else.
   - Commit questions change the ask ("Can you apply to 3 jobs today?"), count shown from real data; skipped when the stalled rule fires (`stallsOnApplications`) or casual.
2. **"Still searching?" journey check-in** — `JourneyCheckInDialog.tsx`, due via `checkInDue` in `src/lib/journey/journey.ts`; cadence by stage `checkInDays`: Applying/Interviewing/Offer 7, Preparing 14, Exploring/Staying 30, Landed 90 (on a break: one week before the return date). Answers (`CHECK_IN_ANSWERS`) call `answerJourneyCheckIn` in `src/app/dashboard/journey-actions.ts` -> `applyJourneyChange` and move journey or stage (e.g. "I was laid off" -> LAID_OFF/APPLYING; "not looking right now" -> STAYING). This is the only check-in that changes the plan: it resets the stage clock and the plan, menu and emails follow. Same answer set is used in the Saturday email (`SEARCH_CHECKIN`) and the college portal check-in (`src/app/i/[slug]/checkin/[id]`).
3. **Weekly email check-in landing** — `src/app/checkin/weekly/` and `/api/checkin/[token]`.

Mood downstream:
- Charts: `MotivationChart` on `https://launchyournextchapter.com/dashboard/stats` and in the coach and admin candidate views.
- `getSentimentAlert` (`src/lib/daily/mood.ts`): lowSentiment when the 14-day average < 30 (mostly Stuck) or the second half is 0.75 worse than the first. Consumers: `src/lib/admin/candidate-detail.ts`, `src/lib/coach/coaching-notes.ts`, `src/lib/coach/matching.ts`, `src/lib/coach/caseload.ts`. **Coach and admin only.** Not shown to the member, and not used to soften the plan, change tone or surface support.
- `src/lib/weekly/visibility-sentiment.ts` (a different sentiment, about visibility).
- Support page: `https://launchyournextchapter.com/dashboard/support` ("Support During Transition", crisis resources). Passive: copy states nothing is triggered by activity.
- Coaching style preference (`coachingStylePreference`: tough love, gentle, balanced) changes `toneLine` text only on the engagement card.
- On the branch: `PIVOT_FEELINGS` (Excited, Curious, Not sure, Nervous, Scared) are stored with each stance change in `journeyDetails.pivot.history`. This is the only feelings capture besides daily mood.

Real data: `DailyCheckIn` and `CheckInPrompt` are live tables written by real use (not noted as empty). Journey check-in works with 0 JourneyEvent only in that new answers create events; old ones left no history.

Gaps: no wellbeing question beyond one mood tap; no free-text; no escalation (low mood does not change the plan, reduce the weekly load, or surface support or a coach in the member's own UI); "Stuck" for N days is detected but only for coaches; mood is not shown in the Home note or journey card; check-ins pop up over every page, which conflicts with "one note, only on Home" in `docs/candidate-redesign.md`.

---

## 4. Skills mapping

What exists:
- **Skills matrix** — `src/lib/profile/skill-matrix.ts` (`skillTerms`, `buildSkillMatrix`, levels Used / Strong / Expert, sources resume / self / certification), built from `resumeKeywords`, `confirmedSkillsHave`, `certifications` and the member's `skillLevels`. Page: `https://launchyournextchapter.com/dashboard/skills-assessment` (Skills Inventory, with the tools checklist `suggestTools` from `src/lib/profile/tools-checklist.ts`) and `https://launchyournextchapter.com/dashboard/skills-assessments` (hub). Setting `skillsAssessmentCompletedAt` counts as an assessment for Candidate+ and for the Peak strengths trait. Everything that matches skills reads `skillTerms()` (jobs, pivots, gaps, learning, college programs).
- **O*NET taxonomy tables** — `Occupation`, `OccupationSkill` (importance, level, hotTech), `Skill` (kind SKILL, KNOWLEDGE, TECHNOLOGY), `OccupationAltTitle`, `OccupationRelated`, `OccupationTask`, `SkillAlias`, `CandidateOccupation`, `CourseSkill` (`prisma/schema.prisma`). Code: `src/lib/careers/*` (`taxonomy.ts`, `vectors.ts`, `skills-fit.ts`, `skills-fit-server.ts`, `candidate-occupation.ts`, `title-match.ts`, `occupation-tasks.ts`, `training.ts`). Import scripts in `scripts/careers/`. Also static `src/lib/pivots/onet-occupations.json` and `occupation-outlook.json`.
- **Skills fit on jobs** — `loadSkillsFit` (`skills-fit-server.ts`): compares the job's title (mapped to an O*NET occupation) with the member's current occupation; band close / good / partial / few, tools to learn, knowledge to build. Shown on job cards (`DiscoverJobCard`, `find-my-job/page.tsx`). Never folded into the fit score. Returns nothing when the taxonomy is not loaded.
- **Personalization signals meter** — `src/lib/personalization/signals.ts`, `know-you.ts`, card `KnowYouCard` / `KnowYouSection` ("Your search is X% tuned": city 25, title 20, tools 20, industries 15, function 10, work setup 10). `retune.ts` and `RetuneMoment` show what changed in matches after a profile edit. This is profile-question personalization with a measurable effect on matching.
- **Spine** — `src/lib/personalization/spine.ts` + `docs/PERSONALIZATION_SPINE.md`: for each journey and stage, which question drives which of plan, learning, networking, opportunities, report, coaching; `spineGaps` feed the engagement card ("Answer one question that sharpens your plan").
- **Learning** — `src/lib/learning/build-learning-plan.ts` and `rationale.ts`: sections ordered by Market Reality Report gaps, "skills to build" tags, function; page `https://launchyournextchapter.com/dashboard/learning`. Course-to-skill link `coursesForSkills` in `src/lib/careers/training.ts`.
- **Interest profiler** — `src/lib/onet/interest-profiler.ts` (O*NET Interest Profiler short form), page `https://launchyournextchapter.com/dashboard/work-interests`.
- Strengths / work style / likes: `src/lib/profile/strengths*.ts`, `work-profile.ts`; pages `https://launchyournextchapter.com/dashboard/strengths`, `https://launchyournextchapter.com/dashboard/work-profile`.

Real data vs empty:
- `CourseSkill` has 0 rows in production, so `coursesForSkills` returns [] and the pivot skill-gap view shows no courses (code handles it by returning an empty list). Fill with `scripts/careers/tag-courses.ts`.
- Occupation / Skill tables may or may not be loaded in production (not verified here); the code degrades silently ("shows nothing rather than a row of unavailable").
- The self-assessed matrix and `skillLevels` are real member data.
- `src/lib/pivots/pivot-map.ts` is in-code, always available, no DB.

Gaps: the skills map is not shown as a single "your skills" view on Home or at the top of Learn; a member's skills are not mapped to a target role's gaps unless they open Pivot paths; learning recommendations do not use O*NET skill gaps or `CourseSkill` (empty); no re-evaluation over time (no "skills gained since week 1").

---

## 5. Career exploration and pivot paths

- **Pivot paths page** — `https://launchyournextchapter.com/dashboard/pivot-paths` (`src/app/dashboard/pivot-paths/page.tsx`). `/dashboard/pivot` redirects here. Components in `src/components/dashboard/pivots/*` and `pivot/*`.
  - Market-ranked pivots: `src/lib/pivots/load.ts` (`loadPivotPaths`), `pivot-map.ts` (in-code roles and edges: carry-over skills, gaps, time-to-pivot, pay path, fit), `market-stats.ts` (open jobs near the member and nationally), `scoring.ts`, `onet.ts` (edges), `occupation-outlook`. Needs a current role (resume title or primary function) or shows "Tell us what you do now". Shows a "your field is contracting" banner (`result.contraction`).
  - Skills + local pay layer: `src/lib/careers/pivots.ts` (`similarity`, `overlap`, wage floor Any / Within 15% / Same or higher, default within 15%), `pivot-depth.ts`, `local-pay.ts`, `occupation-tasks.ts`, `training.ts` (WIOA-approved `TrainingProgram` rows by state).
  - Preferences: `PivotPreference` (people-energy answer, hidden paths) via `src/app/dashboard/pivot-paths/actions.ts`; role lookup, occupation chooser.
  - Trigger: member opens it. Links to it exist from the job board (`PivotBoardBanner`), the market page, market size block, staff program card. No time-based nudge.
  - Changes: display only, plus `isPivoting`-style preference writes. Does not alter target function or job matching.
- **Career-change journey** — `CAREER_CHANGE` playbook (weeks 4, 12, 20, 30) and plan items (`JOURNEY_PLAN` in `plan.ts`).
- **Market page** — `https://launchyournextchapter.com/dashboard/market`, `local-market`, `market-intelligence`, `market-reality`: `src/lib/market/*` (BLS, Adzuna, occupation trends, market size, metro areas), `src/lib/census/*` is not market data (it is outplacement census communications and API keys for partner reporting), `src/lib/market/occupation-trends*`.
- **Early career** — `src/lib/early-career/*`, page `https://launchyournextchapter.com/dashboard/early-career`: audience NEW_GRAD (0 to 2 years) or EARLY_CAREER (2 to 5) from `earlyCareerAudience()` (journey STUDENT_NEW_GRAD or career-stage ladder); first-job checklist and growth checklist, majors to roles (`major-roles.ts`), entry pay (`pay.ts`). Home: `EarlyCareerHomeModule` (next three open steps), plan gets `AUDIENCE_PLAN` items, student playbook weeks 2 to 20.
- Real data: pivot map and market stats use real job postings in the DB; skills layer depends on the O*NET load; `TrainingProgram` is per-state import coverage. Not verified for production size.

Gaps: no trigger from time or stall to "explore other roles"; the exploration surface is Jobs > Market, not on Home, Learn or Network; skills and pay depth is separate from the market-ranked list; no preference history (feelings, stance) on main.

---

## 6. Home page composition: `src/app/dashboard/page.tsx` (`https://launchyournextchapter.com/dashboard`)

Top to bottom, with what decides each piece.

| # | Element | Source | What decides it |
|---|---|---|---|
| 1 | Email confirmation banner | `EmailConfirmationBanner` | Supabase user has no `email_confirmed_at`. |
| 2 | Pending employer reference banner | `PendingEmployerReferenceBanner` | Reference requests addressed to the user's email. |
| 3 | Headline (h1) and stage chip | `getJourney(journeyNow).goal`; `getStage(stageNow).label`; "Not quite right? Change" -> `https://launchyournextchapter.com/dashboard/privacy` | `effectiveJourney`, `effectiveStage` (`src/lib/journey/journey.ts`, derived from `journey`, `journeyStage`, or `currentJobStatus`). **This is the existing "journey card":** one sentence goal and a stage pill. There is no richer journey card (no progress, no time on journey). The journey picker (`JourneySelector`) lives on the privacy page. |
| 4 | Outplacement and staff program cards | `OutplacementProgramCard`, `StaffProgramCard` | Member belongs to a sponsored program. |
| 5 | Today's note (Daily message) | `PageHeaderBoxes pageKey="dashboard"` (+ Action Plan box and welcome video) | Override chain: Market Reality report ready (`marketRealityReports.length > 0 && badgesLastSeenCount === null`) -> Search Strategy not complete (`isSearchStrategyGateComplete`) -> email, calendar and LinkedIn not all connected (`PreConnectDailyMessage`) -> otherwise admin-authored rotating daily message (or watchlist alert). |
| 6 | "Did you apply?" prompts | `HomeApplyPrompts` -> `loadApplyPrompts` | Job board apply-clicks in the last 7 days with no applied record. |
| 7 | Supporter cheer | `supporterCheer` unseen | Latest unseen cheer. |
| 8 | First week card | `FirstWeekCard`, `firstWeekStep(registrationCompletedAt)` | Registered within the first week. |
| 9 | Early-career module | `EarlyCareerHomeModule` | `earlyCareerAudience(profile)` non-null (new grad or 2 to 5 years). |
| 10 | **The one note** (`noteKind`, first match wins) | `page.tsx` | In order: `coaching_form` (coach consent given and no onboarding form) -> `stalled_search` (rule 4) -> `passive_to_active` (rule 5) -> `got_hired` (`weekNumber >= 2 && bountyClaimCount === 0`) -> `search_playbook` (rule 3) -> `culture_survey` (MemberInsightPrompt: rate a former job or describe a company culture). Logged as PostHog `home_note_shown { kind, journey, stage, weekNumber, audience }`. **Practical effect: `got_hired` shows for nearly everyone from week 2, so the playbook and culture survey almost never show.** |
| 11 | Employer interest, portfolio access requests, reconnect banner | `EmployerInterestSection`, `PortfolioAccessRequestSection`, `ReconnectBanner` | Pending items. |
| 12 | Engagement card ("Get more from NextChapter" or the stalled "N weeks in...") | `EngagementCard` -> `getEngagementLead` (`engagement-data.ts`) | Null when connected, proving and not stuck. Otherwise up to 3 unlock steps (connect Gmail / calendar / LinkedIn, references, assessment, résumé issues, spine questions) and/or the time-and-pattern gate (rule 2). One primary button. Tone from coaching style. |
| 13 | Get seen by recruiters card | `HomeRecruiterGoalSection` | Candidate+ not unlocked and not revoked; steps from `candidatePlusSteps` plus the recruiter opt-in. |
| 14 | Weekly plan block | `HomeWeeklyPlan`: `WeeklyFocusCard` (Victoria, locked until email + calendar + LinkedIn connected) and `SuccessSprintCard` (this week's committed actions, suggestions, points vs. target, `onTrack`, profile and search-strategy checklists, references, grade-based resume task) | Plan = `getSuggestedActions` -> `shapePlan` (engagement items first, casual light plan, journey plan, SEARCH_GATES, general menu). Target = ramp by week number, halved if casual. |
| 15 | Jobs module | `HomeJobsSection` -> `JobsModule` + `FreshJobsPrompt` | Counts: saved (no `appliedAt`), applied, interviews (`interviewLandedAt`). |
| 16 | Network module | `HomeNetworkSection` -> `DashboardNetworkCard` | `getNeedsFollowUpList`, `getEmailReminders`. |
| 17 | Unlocks module | `HomeUnlocksSection` -> `UnlocksModule` | Only when `getHardGateStatus` is unlocked or exempt (Search Strategy done). Ladder + evidence areas count. |
| 18 | Session impact card | `SessionImpactSection` | Unviewed coach session in the last 7 days (live LLM call). |

Not on Home: nine-trait dossier, mood, the weekly market grade, skills, pivot suggestions, a time-on-search indicator.

Layout-level (any dashboard page): check-in pop-up or "Still searching?" pop-up (section 3), Candidate+ unlock screen, help launcher, nav badges.

Compare to the redesign mockup `src/app/dev-preview/_mockups/home.tsx` (one `HomeNote` with title, why, and Start; plan module with minutes; Jobs module). The mock has no personalization strip yet; the `HomeNote` is a single card with "why".

---

## 7. Unmerged branch `origin/claude/compassionate-edison-fkfdu5`

Branched from main at 534c1ef0. 117 files, +6,449 / -294. Commits: Personalization alignment audit, Not-searching journeys, Align personalization, What would it take, Thinking about a pivot, Your career story. Not merged, not run in production. Includes manual SQL (`prisma/manual/2026-10-17-career-events.sql` adds `CareerEvent`; must be applied before the career story shows anything beyond derived events).

What it adds:
- **Career story** at `https://launchyournextchapter.com/dashboard/my-career` (tab "Career timeline" under Personalize; a compact copy in the Market Reality report). `src/lib/career-story/{events,layout,summary,pause,doors,peers,validate,load}.ts`, components `src/components/dashboard/career-story/*`, doc `docs/CAREER_STORY.md`. A private timeline of school, work, ventures, pauses and learning, built from work history, education, learning badges and quiet stretches of 90+ days ("A pause", "Between roles"); member can add, correct or hide events (`CareerEvent` table). "Doors you could open" (`doors.ts`, ranges not dates), a "pause what-if" tool (`pause.ts`, uses `cushionMonths` in `journeyDetails`), a "People like you" card (same function, real members only, not confidential, groups < 10 hidden, counts under 50 rounded to 5). Private: never read by employer, college, coach or recruiter code (enforced by test). PostHog events `career_story_*`.
- **What would it take** (`src/lib/journey/pathway.ts`, `feasibility.ts`, `industry-feasibility.ts`, components `pathway/PathwayExplorer`, `IndustryRealityCheck`): for a move into another function, what you already have, what you need, cost and time ranges, challenges, entry roles, a feasibility tier, and alternatives when the member says why they like it. Works without the O*NET data (curated `FUNCTION_PROFILES`). Rendered on `https://launchyournextchapter.com/dashboard/pivot-paths` (`WhatItTakes`, `?target=...&why=...`). Event `pivot_pathway_viewed`.
- **Thinking about a pivot** (`src/lib/journey/pivot.ts`, `pivot-ideas.ts`, components `PivotRadar`, `PivotIdeas`, `PivotOpennessField`): stance per idea (On my radar, Trying it out, Getting ready, Going for it, Not for me right now), feeling (Excited, Curious, Not sure, Nervous, Scared), notes, and history kept over time in `journeyDetails.pivot.history`; ideas for functions, industries and skills from the member's own background; `pivotPlanItems` turns stance and commitment (route, hours per week) into weekly plan steps in gentle language. Any searching journey can carry it; Career change journey sets `isPivoting`.
- **Learning paths** (`learning-paths.ts`, `learning-paths-data.ts`, `LearningPathsCard` on Learn and pivot-paths): paths tied to a goal the member stated or inferred; progress tracked.
- **Plan reads profile answers** (`engagement.ts` `profileDrivenItems`): targets, comp floor, application and outreach goals, follow-up, relocation. **The one time-driven scope widening in the repo:** at APPLYING for 6+ weeks the plan adds "search roles in {states you said you would move to}" or "widen to about N miles" or "look outside your area" from the `relocation` answer (`src/lib/journey/relocation.ts`, `RelocationField`). It advises; it does not change stored scope.
- **Not-searching journeys**: `NOT_SEARCHING_JOURNEYS` (GROWING, ENTREPRENEUR, FRACTIONAL, TIME_OFF) and STAYING/PAUSED get the light pace, no progress-push emails (`NOT_CASUAL_WHERE`), no hard gate; `getPace` treats them as light.
- **Plan follows journey change**: `rebuildCurrentWeekPlan` and `mergeRebuiltPlan` in `src/lib/weekly/sprint.ts` replace open steps immediately when journey or stage changes, and `planWeek` restarts at 1 on a new journey. A change-confirmation message (`change-message.ts`).
- Sponsored seats set a starting journey (`sponsored.ts`), career-growth cohort reporting.
- It also touches `docs/PERSONALIZATION_ALIGNMENT_AUDIT.md` and `docs/JOURNEY_AUDIT.md` (read these before redoing any of this). The dev-preview registry already lists "Career story: replaces /dashboard/my-career (other branch)".

What it does not add: nothing new for time/stall rules beyond the week-6 relocation step; no mood or wellbeing logic beyond pivot feelings; no skills-map changes; no Home composition change except a searching flag passed to the search strategy checklist (`page.tsx` 1-line).

Merge risk: it changes `engagement.ts`, `journey.ts`, `plan.ts`, `sprint.ts`, `pace.ts`, `intensity.ts`, `schema.prisma`, `pivot-paths/page.tsx`, `learning/page.tsx`, `JourneyCheckInDialog.tsx`; any redesign of those will conflict.

---

## 8. Gaps against the owner's intent (all six)

1. **Dossier / Candidate+**: traits are live but only on Stats; the Home strip would need `loadTraitSignals` + `buildEvidenceTraits` in `page.tsx`. Two different "dossier progress" numbers exist. Ladder still shows locked rungs after unlock.
2. **Time**: rules exist (section 0) but they advise only, use three different clocks, ignore results (playbook) or journey (gate), apply only to APPLYING/INTERVIEWING, and nothing ties them to Pivot paths or to widening stored scope. `search-efficiency.ts` and the weekly grade are never used as inputs. Home hides the playbook behind `got_hired`.
3. **Check-ins**: mood is collected, not used for the member. Sentiment alert is coach-only. No wellbeing path in the plan or Home. The pop-ups are layout-wide and conflict with "one note on Home only".
4. **Skills mapping**: the self-assessed matrix and O*NET fit exist; `CourseSkill` empty so skill gap to course is empty; no single "your skills and gaps" view up front.
5. **Career exploration / pivot**: strong on a manual visit; no trigger from stall or grade; feelings and stance history only on the unmerged branch; F-grade pivot reframe lives in the report only.
6. **Journey card on Home**: today it is a headline sentence and a stage chip. No time on journey, no progress, no "what changed", no link to Personalize. `journey` + `journeyStageChangedAt` + `journeyCheckedAt` + `JourneyEvent` history are available to build one (with 0 JourneyEvent in production, history will start empty).

## 9. Production data notes

- 0 JourneyEvent: `loadSearchPlaybook` falls back to `journeyStageChangedAt`, then first application; the engagement clock (`weeksInStage`) never reads JourneyEvent; `journeyStageChangedAt` is only set on a stage change, so members who never changed stage get `createdAt`.
- 0 CourseSkill: course-for-skill matching returns nothing (training.ts catches and returns []).
- Not verified here (no DB access in this pass): row counts for `DailyCheckIn`, `CheckInPrompt`, `Occupation`/`OccupationSkill`, `TrainingProgram`, `MarketRealitySnapshot`.
