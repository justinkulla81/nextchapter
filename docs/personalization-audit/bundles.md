# Question bundles: every question grouped, with its payoff

Built from `questions.md` (row numbers in brackets) after the owner's decisions of 2026-10-17: questions that change nothing the member can see are dropped, and every kept question is asked in a bundle of **at most three**, under one strip, with a named payoff shown the moment it is answered.

## Decisions (owner, 2026-10-17)

- Victoria's chat replies are out of scope for now. Where a payoff said "Victoria's reply", it now means the one note on Home. What to do with Victoria comes later.
- Build H2 (what gets in the way) and H3 (what drives you) so they change the week and the one note.
- The unread instruments: connect Track Record and What I Need to the dossier, drop the benefits priorities and red-flag extras that nothing reads (red-flag yes/no answers that drive plan steps stay, in J7).
- Drop the 21 unclear questions unless a bundle names them.
- The Home strip is called "Build your plan". The landing is "Your week".

## The rules

1. **At most three questions per bundle.** Each takes under a minute. A bundle is one screen or two.
2. **One home per fact.** A fact is asked in exactly one bundle. Every other place shows it read-only with "change". (City is asked in 4 places today, industry in 7.)
3. **Payoff first, payoff after.** Each bundle opens with "why we ask" and ends with a receipt: what changed, in which places, by how much. No bundle ships without a receipt.
4. **No honest payoff, no question.** If a receipt cannot show a real change, the question is dropped or wired up first.
5. **Ask when it matters.** Onboarding asks only what the first week needs. The rest is asked later from the strip, best payoff first. Long assessments become short rounds that end with something the member keeps.

## The receipt (shown right after a bundle)

A receipt has four parts: a before and after (a number, or a sample for tone), chips for the places that changed (Jobs, Network, Learn, Plan, Dossier), the new tuned %, and the next best bundle. Four kinds, by what can honestly be shown today:

| Kind | Shows | Works today? |
|---|---|---|
| A. Jobs count | "111 jobs became 261" | Yes, but only for the 45 fields job matching compares (`MATCH_INPUT_FIELDS`). The retune view that does this already exists (`RetuneMoment`). Equity, interim interest, willing to start lower, deal breakers, application goal and target company stage are not in that list, so they cannot show a before and after yet. |
| B. Plan or tone change | The new week, or a sample note in the chosen tone | Yes. Plan steps and tone are deterministic. |
| C. People found | "6 people you know work at your target companies" | Needs a contact-to-company match. The "Who can help you get in" logic on a job already does the per-job version. |
| D. Courses | "2 courses now match" | **Blocked.** `CourseSkill` has 0 rows, so skill gap to course returns nothing. Until that is filled, Learn receipts show "jobs this would unlock" instead. |

## Onboarding (about two minutes, before Home)

| # | Bundle | Questions (rows) | Payoff shown | Receipt kind |
|---|---|---|---|---|
| O1 | Where you are | Situation card [1]; one follow-up chosen by journey: start timing [20, 29], return date [30], offering [31], venture one line (new); last day worked moved here [176] | Your first week appears: three steps, and the menu | B |
| O2 | Your résumé | Upload [2]. Resume-book opt-in [4] moves into the privacy bundle N4. Narrative align [3] moves to the résumé page. | "We filled in 9 answers for you" | B |
| O3 | What you are aiming for | Target role [13, 94], function [12, 91] and level [10, 93], confirmed from the résumé. Years [11, 65] come from the résumé. | Live count of jobs | A |
| O4 | Where | City and state as one question [15, 16, 59, 219], work setup [17, 101], relocation [18, 107] | Live count of jobs | A |
| O5 | How we coach you | Push style [39, 120, 214, 217, 47], pace [121], how actively (not employed) [23, 196] | A sample note in your tone, and your weekly target | B |


Removed from onboarding: contract [40, dropped], "I just started" and the two counts [25 to 27, dropped], lead source [52, one optional line on first Home visit], network comfort [38 moves to N2], culture [34 to 37 move to J3], coach consent [41, asked when a coach is assigned].

## Home strip: "Build your plan"

| # | Bundle | Questions (rows) | Payoff shown | Receipt kind |
|---|---|---|---|---|
| H1 | Pace and push | Push style and pace if skipped or changed [39, 121] | Sample note, weekly target | B |
| H2 | What gets in the way | What gets in the way, one list [114, 115]; how the search is going [113] | **To build:** the first step of the week answers the top blocker. Today nothing in the plan reads blockers. | B once built |
| H3 | What drives you | Motivations, one question [118] | **To build:** the one note on Home uses what drives you (for example, "You said family is why. One application today moves that closer."). | B once built |
| H4 | Your time | Hours a week you can give, days you can work (new; replaces the contract [40]) | Weekly target resizes | B |
| H5 | The check-in | One weekly check-in: mood [231], still searching [228, 229, 230], stalled [233], daily action [232] merged into one | A low answer lightens the week and says so | B |

## Jobs strip: "Better jobs for you"

| # | Bundle | Questions (rows) | Payoff shown | Receipt kind |
|---|---|---|---|---|
| J1 | Tools and skills you have | Tools [164], skills you have [161, 67], skill levels (optional) [163] | Jobs that ask for them | A |
| J2 | Pay (only when money help is on) | Minimum pay [104, 141], flexible [105], equity [106]; last salary [66] is asked only here too | Jobs inside your range | A for pay; equity cannot yet |
| J3 | What a great job looks like | Rank what matters [110]; culture, six short choices in two rounds [34, 35, 123]; one deal-breaker line replacing four boxes [36, 37, 111, 48] | Jobs reordered, with the reason on each | partly A |
| J4 | Company | Size [99], type [100], employers to hide [112, 221] | Jobs and companies reordered | partly A |
| J5 | Kind of work | Full-time, part-time, contract, advisory [224]; interim interest [109]; board willingness [144] | Jobs by work type | A |
| J6 | Requirements | Work authorization and visa [78]; travel percent [108, 19]; clearance and licenses, only if relevant [75, 76] | Jobs unlocked | A |
| J7 | Before you apply | Let go for cause, shown to laid-off members only [69]; non-compete yes/no [70]; background and drug checks as one question [72, 73] | The guidance for how to answer, which exists today | B |

Moved out: pivot and willing to start lower go to Learn (L3), because they are about direction. Application goal [102] goes to H4.

## Network strip: "Warmer introductions"

| # | Bundle | Questions (rows) | Payoff shown | Receipt kind |
|---|---|---|---|---|
| N1 | Who you want to reach | Target companies (reuse the company watchlist [227]); kinds of people to reach (new) | "6 people you know work there" | C |
| N2 | Your style | Comfort reaching out [38, 83, 130]; concerns [131] | A sample draft in your style | B |
| N3 | Connect your people | LinkedIn URL [60]; Gmail and calendar [190]; import contacts | "142 contacts found, 12 due a follow-up" | C |
| N4 | Who can find you | One control replacing six switches [81, 191, 198, 199, 201, 202, 226] | A preview of exactly what a recruiter sees | B |
| N5 | Being visible | Comfort being public [124]; content venues [125] and comfort [126] | Marketing steps appear in This week | B |
| N6 | Your corner | Invite someone [205, 212]; coach preferences: language, timezone, gender [213, 215, 216]; coach consent when matched [41, 207] | "3 coaches match you" or "Alex can cheer you on" | C |

## Learn strip: "Closer to hired"

| # | Bundle | Questions (rows) | Payoff shown | Receipt kind |
|---|---|---|---|---|
| L1 | Skills to build | Up to three skills [162, 166] | Jobs this would unlock (courses once `CourseSkill` is filled) | A or D |
| L2 | AI skills | Confidence in AI skills [159] | Learning plan changes | B |
| L3 | Open to a change? | Pivoting [95]; target function [96]; start at a lower level [97]; "big change or more of the same" [122] folds in | Other roles you could do, and what each would take | A for pivot fields |
| L4 | Interview confidence | Telling your story, interviews, negotiating [82, 134, 135, 188] | Practice order changes | B |
| L5 | Deep dives (optional rounds) | How I Work Best [54, 168, 57 items] as 4 rounds; Work interests [170, 60 items] as 3; How I Perform [155, 40 items] as 2; strengths [156 to 160] as 1; ten work-style choices [165, 234] as 1 | A card to keep, one more of nine traits proven, better culture matches | A and B |
| L6 | Education (students and early career only) | School, degree, major, year as one card [6 to 9, 62, 171, 172] | Roles by major | A |

Pending your decision: What I Need [150, 151, 24 items plus rank], Track Record (19 items), benefits priorities [136 to 143]. Nothing reads them today. Connect each to a receipt, or drop it.

## Coach intake (when matched; owned by the coach)

| # | Bundle | Questions (rows) | Payoff shown |
|---|---|---|---|
| C1 | Goals | Successful outcome [42]; offer deadline [43] | The coach sees it before session one |
| C2 | How we work | Prior coaching [44]; cadence [45]; between-session contact [46] | Coach and session cadence set |
| C3 | Anything else | Constraints [48]; biggest worry [49, or H2]; confidential note [50] | Private to the coach |

## Account and privacy (settings, not strips)

Name [56]; phone [57]; photo [61]; email [51]; notification tier [203]; leaderboard [202]; connected accounts [190]; delete or download [208]. These are not asked as payoffs. The three rows for demographic self-identification [77] and age range [177] are asked only inside the apply flow and the outcome form, not here.

## Tracked records (tools, not personalization)

In-work [179 to 186], got hired and bounty [174 to 178], job description [187], interview and narrative text [152, 153, 189], job passes [222, 223], filters [225], tracker [227]. These stay as they are. They are what the member does, not what we ask about them.

## Dropped (stay dropped)

[25, 26, 27, 40, 58, 71, 74, 87, 103, 119, 127, 132, 145, 146, 204]. See `README.md` for which of these were promised a later feature.

## Still to decide (21 unclear rows)

Align resume to a narrative [3]; graduation year [9]; lead source [52]; the two copies of How I Work Best [54, 168]; what you can teach [68]; demographics [77]; work sample type [84]; why lower level [98]; consistency rating [116]; LinkedIn usage [128] and up to date [129]; referred before [133]; PTO and parental leave [139, 142]; learned new skills [147]; tried coaching [148]; recruiters connected [149]; interest profiler [170]; age range [177]; job reviews and culture survey [235]. Default: drop unless a bundle above names it.

## Counts

236 questions today. After the audit: 15 dropped, 75 merged into one home each, and the kept ones fall into 36 bundles of at most three questions: 5 onboarding, 5 Home, 7 Jobs, 6 Network, 6 Learn, 3 coach intake, and the settings group. Tracked records stay as tools.

## Dependencies before any receipt can be real

1. Jobs count works only for the 45 matched fields.
2. `CourseSkill` is empty, so course receipts wait.
3. Blockers, pace, motivations and readiness change nothing today. H2 and H3 need a build, or they go.
4. Contacts need a company match for the people receipt.
5. The menu reads only journey and stage, which is fine, because bundles do not need to change the menu.
