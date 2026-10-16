# Personalization alignment audit

Written 2026-10-16 from the code at `claude/compassionate-edison-fkfdu5`. Static read; the app was not run.
Three read-only passes (Search Strategy; onboarding, goals, red flags and assessments; gates and features by journey) plus spot checks.
Every claim cites code. Where I verified a claim myself it is marked **(checked)**.
It supersedes the "Data collection → consumer mapping audit" in `OPEN_ITEMS.md` (2026-08-14), which is partly stale (section 6).

Terms: **plan** = weekly plan (`sprint.ts`, `plan.ts`, `engagement.ts`). **Matching** = job ranking and fit (`src/lib/jobs`). **Report** = Market Reality Report.
**NS journeys** = the four that are not a job search: Managing my career, Taking a break, Happy with fractional, Building something.

## 1. Headlines

1. **The plan reads almost none of what members tell us.** `plan.ts` reads zero Search Strategy fields. What reaches the plan: level (career stage), how hard the search feels (pace and casual), feedback tone (wording only), culture, red-flag answers, and a few journey details (return date, fractional offer, open days, engagement end). Targets, comp floor, remote, relocation, industries, company size and stage reach matching and the report, not the plan.
2. **Matching is journey-blind.** The only journey read in job ranking is `NEXT_ACT` in `work-type.ts:274`. The Market Reality scoring has no journey or stage reads; the journey only changes the report's prompt text.
3. **Changing careers never sets the pivot flag. (checked)** `isPivoting` and `targetFunction` come only from a toggle on Search Strategy. So a Changing careers member is ranked against their old function (`job-match.ts:585`).
4. **The four non-search journeys are asked search questions and get search pressure.** Search Strategy shows everything but the culture page to all 11 journeys. Their pace is the full search ramp, and they get the Wed/Thu/Fri progress emails, because the only email filter is the casual setting. (checked for the midweek email; the other two use the same filter)
5. **For those four journeys the Search Strategy bonus and Victoria's strategy guidance are unreachable.** Completion needs target role, industries, company size and stage, which they are never meant to answer.
6. **Red flags are used in one place, in one sentence each, and the page copy is wrong. (checked)** The screening page says answers are "shared with your coach and recruiter/employer contacts"; `visibility.ts` sets `screening: none` for all of them, and the docs agree with the code.
7. **The spine's guard is weaker than it looks.** `spine.ts` has 36 questions. Red flags, Track Record, What I Need, Work Interests and the coaching form are not in it, so the test that "nothing is asked that does not drive something" cannot see them. Two spine claims have no implementation: relocation "adds plan steps" (`spine.ts:231`) and comfort "chooses outreach steps and scripts" (`spine.ts:319`). The test passes because the field name appears in the named files.

## 2. What is aligned (asked, and it changes something the member sees)

| Question | Drives |
|---|---|
| Situation (journey) | Everything: plan shape, gates, menu, report framing, confidential default |
| Highest level, function, years, career stage | Matching, report, Dossier, learning plan, early-career plan variant |
| Target role type, industries, company size, company stage | Matching (`job-match.ts`, `job-fit-bucket.ts`), report, Dossier |
| Comp floor, flexible, equity | Matching, report, negotiation advice, coach notes |
| Remote preference, relocation | Matching, recruiter report, Dossier |
| Five priority ranks | Matching weights (job security is weaker: not in `job-fit-bucket`) |
| Deal breakers | Report text, Victoria guidance, coach red lines (not matching) |
| Willing to start lower | Matching, Dossier, coach |
| Interim and consulting interest, board and advisory willingness | Work-type defaults on the job board |
| Search intensity and "how hard is the search" | Plan pace, gate timing, daily pop-up, three emails, report |
| Feedback tone | Plan wording, report directness, coach replies |
| Culture (importance, dimensions, must-have) | Plan items, matching, report, interview prep |
| Apply timing, laid-off timing, move driver | Stage and plan |
| Return date, fractional offer, open days, engagement end | Plan steps (plan only) |
| AI displacement reason | Plan step (plan only) |
| Last salary | Matching reference, negotiation advice, pay page |
| Benefits priorities (9) | "Ask for these" on Know your worth (was wrongly listed as orphaned) |
| Track Record (12 of 19) | Strengths, Dossier, work profile, Build your case |
| How I Work Best, What I Need (8 items), How I Perform | Work profile, job fit (+/-15), Dossier, pivots |
| Work Interests | Job ranking bonus |
| Parallel paths | Job board ranking |

## 3. What is not aligned

### 3a. Asked, and nothing reads it

| Field | Where asked | Note |
|---|---|---|
| willingToFollowUpOnApplications | Search Strategy | Zero reads |
| recruiterConnectionCount | Search Strategy | Zero reads |
| restrictiveCovenantDetails | Screening | Free text never read or shown back |
| wantsAnimalFriendlyWorkplace | Screening | Not in matching |
| contractAccepted (accept or decline) | Onboarding | Comment says decline lowers assumed intensity; no code does that |
| justStartedSearch | Onboarding | Only zeroes two counts |
| actionWindow (daily-email time) | Privacy | Controls nothing |
| 7 Track Record fields | Track Record | approvalAuthority, situationRanking, mandateClarity, functionsOwnedOutsideCore, sectorHistory, stageHistory, accomplishmentToConfirm |
| About 16 What I Need items | What I Need | Used only for similarity with other members |
| managedPeople | (no form writes it) | Dead field |
| workingNow | Onboarding | Loaded, never used |
| venture (journeyDetails) **(checked)** | Settings | Written, read nowhere. Added in this session's earlier change; the Building something plan step still cannot use it |
| PeerNomination, BackgroundCheckConsent, PivotIdea | none | Zero references |

### 3b. Used only as a completion flag or for display

networkingOutreachTargetPerWeek (a "self-set weekly target" that no plan step uses), linkedinOpennessComfort, independentWorkExperience, jobsAppliedBucket and interviewsReceivedCount (only "answered" flags; the zero-activity gate ignores them, so an off-platform applicant is told "your search has not started"), changePacePreference and changeReadiness (Victoria text only), blockers and motivations (coach text), six coaching-form answers, startLowerRationale, relocationNotes, travelWillingness, howHeard, past-job reviews (help other members, never the reviewer's plan).

### 3c. Claimed but not implemented

- Screening page copy: shared with coach, recruiters and employers. Code: shared with no one. **Decide which is right; the code and docs agree, so fix the copy.**
- Spine: relocation adds plan steps; comfort chooses outreach scripts (canned text only).
- Schema comments: "domainRank is the report headline", "integrityScore read by Coaching Notes", "accomplishmentToConfirm routes into reference verification". None is true.
- `journeyDetails` schema comment promises inside-or-outside for promotion, from/to for a career change, graduation date. None is ever written.
- Unlock copy "Unlocks Network, Jobs and Interim Work" is shown to Managing my career and fractional members whose Jobs tool is locked (and Interim hidden for the first).

### 3d. Asked of journeys it is wrong for

- **NS journeys** see the full Search Strategy wizard (target role, company size and stage, comp floor, application volume, relocation, remote, priorities, blockers, change readiness), the "Culture you want" card (the wizard culture page is hidden, its sibling card is not), and the screening page. None of it changes their plan.
- "How long have you been searching" is on the form for every journey; it is nulled for employed and non-search members, then the checklist lists it as permanently incomplete and the daily message nags about it.
- Application volume goal is shown to everyone; application targets are dropped for non-active searches.
- AI displacement is asked only of out-of-work searchers; employed searchers (Thinking about a move, Promotion, Changing careers, Next act) are not asked, though they can be displaced too.
- Firing for cause is asked only when the status is Laid off; resigned and other exits are not covered.

### 3e. Journey-blind logic and silent gaps

| Issue | Effect |
|---|---|
| `isPivoting` only from a toggle **(checked)** | Changing careers ranked against old function; no extra step-down window |
| Pace and the Wed/Thu/Fri emails use search intensity only | Managing my career, break, fractional, building get full ramp and progress pushes |
| `PersonalContextForm` difficulty 1 forces casual even if "actively looking" | Silently halves pace and gate timing |
| Zero-activity gate ignores self-reported counts | Off-platform applicants told they have not started |
| Laid-off "27 weeks" message clock | `lastJobEndedAt` is only written after getting hired, so it counts from search start, not job loss |
| `willingToStartLower` is a Boolean defaulting to false | "Unanswered" is invisible; the spine never prompts it |
| Job board work-type defaults | Fractional members get no part-time or contract default; Next act is set by journey alone, without asking |
| Next act's comp floor | Meaningless for part-time, contract and advisory roles, where pay is not compared |
| `calendar` signal and `isSearching()` | Defined, never used |
| Red-flag guidance | Plan only, from Preparing onward, not in emails or the dashboard card; the page sits behind a points bonus so most reach it late |

## 4. Journey by journey

"Asked" = spine questions that apply (from `spine.ts`).

| Journey | Asked | Plan reads | Main alignment gap |
|---|---|---|---|
| Laid off | 25 | tone, pace, gates, red flags, AI step, laid-off timing | No severance, benefits or unemployment dates, so the benefits steps are text only; runway unknown; the long-term clock is wrong |
| Thinking about a move | 25 | tone, pace, culture, move driver, red flags | Nothing on notice period, who must not find out, or counter-offer |
| Managing my career | 7 | level, tone, pay | Almost nothing about what they want: next review date, raise or level target, manager or sponsor, skills to build. This is the journey companies buy for |
| Promotion | 24 | as above | Target level or title, decision-maker, inside or outside, and the gap to the next level are not fields; the plan step is text |
| Changing careers | 25 | as above | Pivot flag not set; no from/to, bridge credential or pay step-down answer |
| Student or new grad | 23 | early-career variant | Graduation date, major and work-authorization exist but the plan and gates do not read them; no start-by date or internship vs full-time |
| Returning | 24 | as above | No break length or reason, preferred hours, or returnship wish; "how long searching" is not break length |
| Next act | 24 | work-type default | No board experience or sectors, day rate, hours per week, income need versus purpose |
| Taking a break | 6 | return date | Leave type and pay end date are text steps only; no "same employer or new" |
| Happy with fractional | 9 | offer, open days, end date | No day rate, client count, ideal client, pipeline stage |
| Building something | 6 | nothing | Venture not read; no runway, income need, health cover or willingness to take contract work |

## 5. Data we do not ask but probably should

Checked against `CandidateProfile`, `WorkHistoryEntry` and `EducationEntry` before listing. "Partial" means a nearby field exists.

**Laid off:** severance end date; benefits or COBRA end date; unemployment benefit end date; monthly cash need or runway; separation reason beyond a for-cause yes/no; last day worked at onboarding (the field exists but only on got-hired).
**Thinking about a move:** notice period; target move date beyond timing bucket; who must not find out; whether a counter-offer would change the decision.
**Managing my career:** next review date; target raise or level; top two skills to build (growthAreas exists, partial); manager or sponsor named; how long in role; whether they want to stay, grow or leave in 12 months.
**Promotion:** target title or level; inside or outside; decision-maker and timing; the evidence they already have.
**Changing careers:** from and to field; bridge credential in progress; acceptable pay and level step-down (needs a three-state answer, not a default-false boolean); how soon.
**Student or new grad:** graduation date and major (collected, not used); start-by date; visa or OPT need (partial); internship vs full-time; location flexibility.
**Returning:** break length and reason; preferred hours or schedule; returnship or part-time wish; skills to refresh.
**Next act:** board experience and sectors; day or hourly rate; hours per week and number of engagements; income need versus purpose; retirement timing; in-person geography.
**Taking a break:** leave type and whether paid; pay and benefit end dates; same employer or new.
**Happy with fractional:** current and target day rate; number of clients; ideal client and industries; pipeline counts; engagement types wanted.
**Building something:** what they are building (collected, unread); runway and income need; health coverage dependence; willingness to take contract work; target date to decide.
**All journeys:** a "what would make this week a good week" free text; time available per week (the plan has no idea how many hours someone has); preferred days or times (this is what `actionWindow` pretends to do).

## 6. Corrections to `OPEN_ITEMS.md` (2026-08-14)

- Track Record is no longer orphaned: 12 of 19 fields are read; 7 are not.
- What I Need is no longer orphaned: 8 items feed the work profile and domainRank feeds the pay page.
- Benefits priorities now have a member-facing consumer (`review-prep/benefits.ts` → pay page), not matching.
- `priorityJobSecurity` is read in `job-match.ts:338`; it is still missing from `job-fit-bucket.ts`.
- `creativityConfidence` is read by the work profile; not an orphan.
- Still true: willingToFollowUpOnApplications, actionWindow, integrityScore, the three dead models, jobSearchIntensity, red flags reaching no recruiter or admin surface.

## 7. Fix list, in order

1. **Fix the screening page copy** (it states a sharing that does not happen). One line, no schema.
2. **Journey-aware Search Strategy:** hide or collapse search-only sections for the four NS journeys; give them their own short "what you want from your career" section (section 5, Managing my career). Remove the permanently-incomplete `gapDuration` checklist item for non-searchers.
3. **Pace and emails for NS journeys:** treat NS as not-searching in `paceFor` and in the progress-email filters.
4. **Set `isPivoting` (and ask target function) when the journey is Changing careers.**
5. **Put targets into the plan text:** target roles, companies, location, comp floor, remote, so "Pick three target roles" names yours and "widen your targets" says how.
6. **Read what we already collect:** venture, graduation date and major, self-reported application counts, workingNow, networkingOutreachTargetPerWeek, applicationVolumeGoal.
7. **Close the spine gap:** add red flags, Track Record, What I Need, Work Interests, lastSalary and the coaching form to `spine.ts` so the guard covers them, and remove or implement the two unbacked claims.
8. **Add the section 5 questions**, journey by journey, starting with Managing my career and Promotion (they feed the employer and college products).
9. **Retire or finish dead fields:** the orphans in 3a. Delete rather than keep collecting.

## 8. Status of the fix list (updated 2026-10-16)

| # | Fix | Status |
|---|---|---|
| 1 | Screening copy matches the privacy rule | Done |
| 2 | Journey-aware Search Strategy and hard gate | Done: not-searching journeys are exempt from the dashboard gate, see a shorter wizard (career, marketing, networking, negotiation, benefits), no culture card, and a checklist that no longer lists search items. Staying and promotion members get a "What you want from your career" page |
| 3 | Pace and progress emails for the four not-searching journeys, and for anyone who says they are not looking | Done |
| 4 | Changing careers sets the pivot flag | Done. Run `prisma/manual/2026-10-16-career-change-pivoting.sql` to flag existing members |
| 5 | Targets in the plan text | Done: industries, comp floor, application and outreach goals, follow-up, widening by places they named |
| 6 | Read what we collect | Done for venture, graduation date, self-reported prior applications, application goal, outreach goal, follow-up willingness. Not done: workingNow (still only a casual flag), `calendar` signal |
| 7 | Spine covers the new questions and red flags | Done for relocation, open functions, career, red flags, situation facts. Track Record, What I Need, Work Interests and the coaching form are still not in the spine |
| 8 | New questions by journey | Done for severance end, coverage end, monthly need, notice, move-by, break length, return hours, day rate, hours a week, runway, leave-pay end, review date, next level, pay or level focus, 12-month intent. Not done: time available per week for every journey, board experience and sectors, number of clients, target date to decide |
| 9 | Retire dead fields | Not done. Still collected and unread: restrictiveCovenantDetails, wantsAnimalFriendlyWorkplace, contractAccepted, justStartedSearch, howHeard, actionWindow, recruiterConnectionCount, seven Track Record fields. Deleting needs a decision per field |

Also built in this pass, beyond the list:

- **Relocation scope** replaces the yes/no: stay local, a wider area (25 to 250 miles), particular states, or anywhere. Matching treats a listed state as a move the member would make and everything else as out of reach. A radius covers the home state only, because distance across state lines is not measured.
- **Openness to other fields, with a sanity check and a commitment.** `src/lib/journey/feasibility.ts` rates a change from one function to another: natural move, bridge (months of learning and proof), rebuild (formal training and a step down), licensed, or a level (not a function). Small moves are searched at once. Bridges and rebuilds are saved but not searched until the member chooses a route (learn on their own or formal training), hours a week, and says they commit. The commitment is remembered in `journeyDetails.pivot`, sets the target function and pivot flag, and puts a weekly learning block with the education steps into the plan.
- **Searcher and career changer at once:** yes. The journey says why, the stage says how close, and the pivot is an overlay that any searching journey can carry. After a commitment the member can tick "Make changing careers my main plan"; the journey changes, the stage stays, and nothing they did is lost.
- **A journey or stage change rebuilds this week's plan at once** (`rebuildCurrentWeekPlan`): finished and started steps stay with their points, open ones are replaced, and the new journey's setup steps appear in its first week instead of being skipped by account age.

Limits to know: the feasibility table is a judgment table, not a prediction, and is not yet joined to the O*NET data (which is not loaded in production); industries are multi-select but have no feasibility check; the settings page does not yet tell the member "your plan now follows X and your N finished steps stay".
