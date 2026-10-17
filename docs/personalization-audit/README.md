# Personalization audit: what we ask, what it changes, and what to cut

Read-only audit of the code on 2026-10-17. Four detail files sit beside this one:

- `questions.md`: 236 questions across 33 pages, one verdict each (125 keep, 75 merge, 15 drop, 21 unclear).
- `fields.md`: the 339 stored profile fields, classified (preference, signal, fact, setting, system) and checked for readers.
- `journeys.md`: all 11 journeys, what each collects and gets, and a matrix against Home, Jobs, Network, Learn, skills, pivot, dossier, check-ins and supporters.
- `signals.md`: time, check-ins, dossier, Candidate+, skills mapping, pivot and the Home journey card.

The audit was done by reading code. Nothing was run, so treat each finding as one to confirm before acting on it.

## The test every question must pass

A question stays only if the member can see what it changed: the jobs they see, the people suggested, the courses, the plan, the tone, or an outcome. Every strip says what is not tuned yet, what answering gets them, and why.

## What the audit found

1. **Most questions never reach the member.** Victoria's replies read about 10 to 13 profile fields. The menu reads only journey and stage. Job matching reads 45. Ten questions are read by nothing, for example the "when are you most ready to take action" question, which the copy says drives the daily email.
2. **The same fact is asked many times.** City and state in 4 places, industry in 7, function and target role in 3 or 4, coaching style six ways, "am I still searching" in five, interview comfort in three, recruiter opt-ins in four, culture and values through five separate instruments.
3. **Time is only partly personalized.** Week-based gates, a playbook and a stalled-search prompt exist. They change wording and plan steps. None widens the stored search, raises the weekly target or points to a pivot. They use three clocks, and the playbook is outranked on Home by "got hired".
4. **Check-ins record but do not respond.** The mood prompt changes nothing for the member. A "Stuck" answer shows one line and a link. The sentiment alert is read only by coaches and admins.
5. **Four of the 11 journeys are poorly served** (entrepreneur, time off, career change, fractional). Members who are not searching get job-search defaults. Career change is not wired to the pivot tools. Independent work is behind a locked tab. Growing is excluded from reviews and raises.
6. **The dossier is hidden from Home, and the Candidate+ ladder still shows locked rungs after the unlock.**
7. **Skills mapping and pivot exist but are on request only.** Skill gap to course returns nothing because no course is tagged to a skill.

## Proposed shape

Personalization is the first strip on four places. Each strip is one line and one control, and collapses to "Tuned" at 100%.

| Place | Strip | Holds (one home per fact) | What it changes |
|---|---|---|---|
| Home | Your journey | Journey and stage, pace, tone, how you are doing, time in search, dossier and Candidate+ progress | The one note, the plan, the weekly target, the tone of every message |
| Jobs | Tune your search | Target role and company, location and relocation, pay, tools and skills, culture, work type, remote | Which jobs, their order, and the verdict reason on each |
| Network | Who you want to reach | Target companies, comfort reaching out, who to ask first, recruiter and visibility choices | Who is suggested, the draft wording, which circles show |
| Learn | Your path | Skills you have and want, goals, pivot interests, time available | Courses, assessments, pathways, "what would it take" |

Facts (résumé, work history, references, screening answers) stay where they are used. Settings (privacy, membership, connected accounts, notifications) live in a small "You" menu.

## Time and progress as personalization

Use one clock per member (weeks in stage), and let results drive it:

- Week 3, applying, no interviews: offer to widen the search (a named change, one tap).
- Week 6: suggest a pivot with the "What would it take" view.
- Interviews but no offers: switch the plan to interview practice.
- Behind pace: more actions on Home, each with its why. Ahead of pace: fewer.
- Signals already exist for all of this: weeks in stage, stage changed date, last job ended, applications, interviews, offers, outreach, effort minutes, streak, weekly market grade, mood history.

## Mental check-ins as personalization

One check-in, on Home, in the member's tone. A low answer changes the plan (lighter week, one small action, a person to talk to) and is stated in plain words. The same answer is never shown to employers or recruiters.

## Journey gaps to close (from journeys.md)

Not-searching journeys need their own plan, points, emails and Candidate+ rule. Career change must set the pivot fields and link to pivot paths. Independent work needs to be reachable from NEXT_ACT and FRACTIONAL. Growing needs reviews and raises. Entrepreneur, returning and time off need a few stored facts (the venture, the break, the leave) so the site can say something specific.

## Cuts proposed now (confirm before any code changes)

- Drop 15 questions nothing reads (listed in `questions.md`).
- Merge 75 duplicates onto one home each.
- Fold 18 write-only and 10 unused fields.
- Replace five culture instruments with one short set.
- Replace six visibility switches with one privacy control that shows the result.

## Decisions for the owner

1. Drop questions nothing reads, even ones added for a future use? (Recommended: yes, and re-add the day it has a use.)
2. Is a "You" menu for settings acceptable, giving five places?
3. Which journeys get a dedicated plan first? (Recommended: the four weakest.)
4. Should "widen the search" change the saved search automatically, or only after a tap? (Recommended: after a tap.)

## Decisions made (owner, 2026-10-17)

1. Drop questions that change nothing the member can see. Confirmed.
2. Do not call the settings menu "You". Name every strip and menu by its benefit. Strips: "Better jobs for you: tune your search" (Jobs), "Warmer introductions: who you want to reach" (Network), "Closer to hired: your path" (Learn), "Your journey" (Home). The all-together page is "Tailored for you" (a Home entry). Account settings are "Account and privacy".
3. The four weakest journeys (entrepreneur, time off, career change, fractional) get their own plan first. Confirmed.
4. Widening the search changes the saved search only after a tap (default, not yet confirmed).

## Questions dropped, and which were meant for a later feature

Source: `docs/OPEN_ITEMS.md` and schema comments, read 2026-10-17. "Later feature" means the code or docs promised a consumer that was never built.

| Question or instrument | Promised for | Verdict |
|---|---|---|
| When are you most ready to take action (`actionWindow`) | Timing of the daily email. The copy promises it. | Cheap to build. Keep only if built in the same change. |
| Weekly outreach target (`networkingOutreachTargetPerWeek`) | A target on the Network page | Drop. Real outreach is logged. |
| Track Record, 19 items | Competency grid, dossier, coaching notes, Market Reality | Not read anywhere. Decide: feed the dossier traits, or drop. |
| What I Need, 24 items | A report headline and tie-breaker | Not read anywhere. Decide: feed matching and culture, or drop. |
| Red flags (covenant, fired for cause, drug test, background check) | "Red lines for recruiters" | Not shown to recruiters. Decide: show in the recruiter view, or drop. |
| Benefits priorities (9 fields) | Job scoring and reports | Not read. Decide: weight in matching, or drop. |
| Interim day rate (`gigDirectoryUnlockAnswer`), independent work grid | Independent-work launch plan | Should feed the fractional plan, which is one of the weak journeys. Keep and wire. |
| Contract: commit to 8 to 12 hours (`contractAccepted`) | A lower bar for an A grade | Drop, or build the promised rule. |
| Motivations free text | Coach panel only | Drop. |
| "I just started", follow up on applications, pet-friendly, street address, covenant details, LinkedIn openness, networking level | Nothing found | Drop. |

## Fields to add per journey

Verified gaps (nothing is stored today, from `journeys.md`):

- **Entrepreneur:** what the venture is, its stage, days a week on it, whether open to a job if it stalls.
- **Time off:** reason, planned return date (exists), whether the leave is funded.
- **Returning:** reason for the break and its length.
- **Career change:** target field (and set the existing `isPivoting` and `targetFunction` when this journey is chosen), step-down tolerance.

Suggestions to confirm (my inference, not found in the audit): laid off last day worked and benefits end date moved into onboarding (the field exists but is asked late); fractional day rate and open days (partly exist); 55+ board interest and income need; growing next review date.
