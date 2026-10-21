# Candidate side: journeys, statuses and features (summary)

Written 2026-10-13 from the code on branch `claude/candidate-features-journeys-y88lop`. For the detail behind each
part see `docs/CANDIDATE_MENU.md`, `docs/AFFILIATIONS.md` and `docs/PRODUCT_VISION_CANDIDATE.md` (older; its
onboarding section is out of date).

## 1. What we are selling

**The best coach you have ever had, built on all your data.** NextChapter's coach (Victoria, disclosed as AI) works
from four streams: your **work** (résumé, references, work samples, Dossier), your **applications** (Gmail and Calendar
tracking), your **networking** (contacts, outreach, community, colleges, recruiters) and your **learning** (skills,
courses, coaching). Every plan, email and prompt is tailored to your job search strategy, your situation and how you
like to be coached. People who have been searching too long get *different things to try*, not reworded reminders.
Free for candidates. People who connect, do the work and prove it get the most.

*Claims to review before launch:* the "best coach" superlative (logged in `docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md`).

## 2. Journeys (why you are moving): 11 (the `JourneyType` enum in `prisma/schema.prisma`; see also `docs/JOURNEY_AUDIT.md`)

| Journey | Starts at | Confidential by default | Goal |
|---|---|---|---|
| **Laid off or let go** (resigned included) | Applying | No | The right role, fast |
| **Thinking about a move** (curious, ready to go, or worried about a layoff) | Exploring | Yes | Know your market and worth, move quietly when you choose |
| **Managing my career** | Managing your career | Yes | Better pay, the next level, skills that hold their value |
| **Going for a promotion** | Preparing | Yes | The next level, inside or outside |
| **Changing careers** | Exploring | Yes | Your first role in the new field |
| **Student or recent grad** | Preparing | No | Your first job, and a strong first year |
| **Returning after a break** | Preparing | No | Back at work, gap explained |
| **Planning the next act** | Exploring | No | Board, fractional, consulting or part-time work |
| **Taking a break** (leave or time off) | Managing your career | No | A return on your terms, whenever you are ready |
| **Happy with fractional work** | Managing your career | No | A steady pipeline of the right clients |
| **Building something of my own** | Managing your career | Yes | Keep your options open while you build |

- "Ready for a new job" was merged into *Thinking about a move*. An old value still reads correctly.
- *Thinking about a move* asks **"What's behind the move?"** (keeping options open / ready to leave / worried about a
  layoff). Worry about a layoff puts runway, severance and unemployment-benefit steps first.
- Employed journeys ask **"When do you want to start applying?"**, which sets the stage. Managing my career skips the search questions.
- Outplacement seats start the Laid off journey. Members from before journeys get one derived from their old job status.

## 3. Statuses (how close you are to applying): 7

There is **no "on a break"**. Someone who is not looking is *managing their career*. Each stage's key activities, the feature for each, the menu, the emails and the marketing text are in `docs/CANDIDATE_STAGES.md` (generated from code: `npm run docs:stages`).

| Stage | What the plan does | Check-in pace | Menu mode |
|---|---|---|---|
| **Exploring** | Learn your market; no application targets | Monthly | Job-search tools locked |
| **Preparing** | Résumé, Dossier, targets, story | Every 2 weeks | Search tools open, offer tools locked |
| **Applying** | Applications and reach-outs every week | Weekly | Everything open |
| **Interviewing** | Mock interviews, references, follow-ups | Weekly | Everything open |
| **Offer** | Negotiate and decide | Weekly | Everything open |
| **Landed** | First 90 days; thank the people who helped | Quarterly | "Manage your career"; job tools hidden |
| **Managing your career** | Reviews, pay, skills, a career that holds up | Monthly | "Manage your career"; job tools locked |

Application tasks and the daily "apply" pop-up appear only in Applying, Interviewing and Offer. A legacy "paused" row in the
database reads as Managing your career. Managing-your-career and Landed members get no job-listing emails (Job Search Daily,
fresh job alerts).

### Active or casual (how hard you are looking)

A second setting, separate from the stage. Someone doing fractional or interim work who is open to something better looks *casually*;
someone who needs a role soon looks *actively*. Asked in onboarding (employed members: their "when do you want to start applying?" answer sets it)
and changeable on Privacy.

| | Actively looking | Casually looking |
|---|---|---|
| Weekly plan | Applications, outreach, gates | Light: look through strong-fit roles, one conversation, keep references and Dossier current; no application volume |
| Stalled-search steps | Weeks 3, 6, 9, 13 | Twice as late (6, 12, 18, 26); "one change, not a full push" |
| Search not started | Prompted to send the first five messages | Not treated as a problem |
| Daily pop-up | Asks for applications unless that advice has stopped working | Never asks for applications; asks for a conversation |
| Emails | Everything | No daily, midweek or Friday progress emails; keeps the Monday plan, Saturday check-in and job alerts |
| Victoria's tone | Follows tenure and preference | Stays gentle |

Once a casual searcher is interviewing, application tasks come back; the lighter email cadence stays.

### How status changes
- **"Has anything changed?"** (dashboard, Saturday email, college check-ins). Answers: Nothing yet; I'm ready to start applying;
  I'm interviewing; I was laid off; I got an offer; I started a new job or got promoted; **I'm not looking right now, I want to manage my career**.
- **Your situation** on Privacy (journey, stage, what's behind the move).
- **"Turn on more tools"** box under the menu: explains why tools are off and updates status in one click.
- **Got An Offer** claim marks the member Landed. A **college** can report laid off or got a job (true everywhere); its
  "no longer looking" closes only that college's flag and never changes the member's stage.

## 4. Onboarding

Situation (pick a journey) → Résumé → Confirm what we read → Location, search status (timing for employed journeys; what's behind the move),
**how actively you are looking** (actively, or casually and open to the right thing; plus whether you are doing fractional or interim work now), **how you like to be pushed** (tough love / gentle / a mix), comfort reaching out → Contract (notification tier, SMS) →
Coach consent and coaching form (only with a coach) → Score reveal → Create account → Welcome (first weekly plan).
Optional later: How I Work Best.

## 5. The menu by status

Each tool is **shown**, **locked** (turns on when your status changes; stays visible with the reason) or **hidden** (irrelevant now and next).

| Pillar | Tools |
|---|---|
| **Personalize** (a group of tools, not a place: now the strips and the Improve your search page) | Search strategy, profile, assessments, Market Reality Report |
| **Prove it** | References, portfolio, marketing plan (LinkedIn) |
| **Search and apply** | Find a job, companies, interview prep, offer, market intelligence |
| **Network** | Contacts, community, inbox, recruiters, universities, college benefits |
| **Learn** | Skills, courses, videos |
| **Coaching** | Executive coach (always visible) |
| **Work now** | Interim, fractional, advisory, EQoverIQ (senior members) |
| **Support and settings** | Stats, benefits and financial bridge, I'm Struggling, membership, help, privacy |
| **Manage your career** *(managing your career)* | Know your worth, prove your results, build skills, practice the hard conversation, know how you work |
| **Manage your career** *(landed, then the same)* | First 90 days, know your worth, thank the people who helped, Offer Bonus claim |

Existing locks stay: Gmail (Network, Jobs, Interim, Contacts), LinkedIn (Marketing plan), Skills Assessment (Learning, Videos), Membership (Coach, Recruiter).

## 6. Personalization (what shapes what a member sees)

Journey · stage · active or casual · what's behind the move · feedback tone · connections · results so far. These drive: the weekly plan, the Market
Reality Report framing, Search Strategy wording, the dashboard card, the menu, connect-account reasons ("why connect Gmail" says something different
to a laid-off member than to someone managing their career), the check-in pace, and every weekly email.

**Feedback tone** (tough love / gentle / mix) sets how direct Victoria is (tough love never starts below "direct"; gentle never goes past "direct") and the wording of the unlock and stalled-search messages.

## 7. The weekly rhythm

- **Plan:** auto-assigned each Monday from journey, stage, driver and engagement; first the next unlock, then (if stalled) what to try instead.
- **Emails:** week-1 kickoff; daily one-action email; Monday "your new week is set"; midweek check-in; market update; Friday gap nudge;
  Saturday "Has anything changed?"; Sunday finish line; Job Search Daily and fresh job alerts (searchers only). The Monday, Friday and Saturday
  emails open with the same **"Get more from NextChapter"** block (what to connect or do, and what it unlocks; or what to try in a stalled search).
- **On the dashboard:** the same card, the check-in card, the daily pop-up, the weekly plan card (titled "Your weekly plan" for non-searchers), grade and badges.

## 8. Time gates and engagement ("do the work and prove it")

**Unlock steps** (most valuable first): connect Gmail, connect LinkedIn, ask for references (3 is the target), fix résumé issues, finish the Personality Profile,
take the Skills Assessment. Each names what it unlocks (Network and Jobs, Dossier, A-List jobs, recruiter visibility, Learning).

**Stalled-search gates** read results since entering the stage, not only the weeks:

| Pattern | What changes |
|---|---|
| Search not started | Send your first five messages |
| Applications, no interviews | Week 3 Résumé Fixer · week 6 widen targets + interim work · week 9 coaching session + critique from someone who hires |
| Interviews, no offers | Mock interviews, behavioral practice, ask for feedback |
| Later (week 13) | Test a different lane; review runway and benefits |

## 9. Several affiliations at once

A member can have outplacement, a coach, recruiters, colleges, a workforce board and a company hiring funnel together. One journey and stage per member,
owned by the member. Each affiliation sees only what its rule allows (Privacy shows each member their own connections and what each sees);
**mood check-ins are never shared with anyone**, and only a coach sees coaching style. See `docs/AFFILIATIONS.md`.

## 10. Feature inventory

**Dossier and proof:** references (request, track, dispute, approve quotes; employer-initiated references), work samples, portfolio of named narratives,
Certified Executive Dossier with share links (7 days / 30 days / never), recruiter database opt-in, A-List.
**Search:** job fit check (5 active postings), cover letters and thank-you notes, discovery queue, NC Job Board, fresh job alerts, Job Search Daily, likely openings, backchannel matches, companies directory and watchlist.
**Interview and offer:** interview prep with a shared active job, STAR practice, negotiation, Offer Bonus claim (A-grade).
**Network:** contact list, LinkedIn CSV import, outreach logging, follow-up queue, Gmail and Calendar activity, community (posts, encouragement, leaderboards), inbox, colleges and benefits network.
**Learn and coach:** skills, courses, certificates, AI-project logging, videos and webinars; executive coach and coach match, coaching form and dossier mirror.
**Work now:** interim, fractional and board roles, launch-plan tracker, EQoverIQ.
**Know your worth and build your case:** Know your worth (`/dashboard/pay`: where your pay sits against advertised pay for your role, the market for your role, what matters besides pay from What I Need and your benefits priorities) and Build your case (`/dashboard/review-prep`: Track Record, work samples, approved reference quotes and learning turned into a case for a review, raise or promotion, with what is missing and three things to settle before you walk in).
**Understand yourself:** Market Reality Report (with ATS matrix), Skills Inventory, Work Interests, How I Perform, Track Record, What I Need, How I Work Best.
**Support:** I'm Struggling, benefits and financial bridge (runway), help and feedback.
**Privacy:** privacy tier, Confidential Search Mode (default on for employed journeys), coach access, share links, college outcome sharing, account deletion.

## 11. Marketing surfaces

Homepage (coach hero, "a coach that has read everything you have done", "searching for too long? the plan changes", the journey cards), nine path pages at
`/start/[path]` (thinking about a move, managing my career, laid off, resigned, returning, promotion, career change, new grad, next act, **searching too long**),
How it works (including a "Help for wherever you are" section with each stage's marketing text and key activities), college alumni pages, `/why-stuck`, `/layoffs`, `/unemployment-benefits/[state]`, reports, news, pricing, FAQ.

## 12. What was closed, and what is still open

**Closed**
- Pay benchmark and review prep exist (Know your worth, Build your case) and use Track Record, What I Need and Benefits priorities.
- Pay comparison now also uses public wage filings (DOL) matched to the member's role, across employers and for companies they track, labelled as an estimate.
- Build your case saves the member's ask (number or level, up to three reasons, walk-away, date) and how it went; an upcoming conversation goes into the weekly plan.
- Weekly point targets follow the pace: half for casual searchers (in steps of 5), everywhere the target is a target, including the weekly effort that feeds the grade. The grade's thresholds are unchanged.
- Screening answers are used privately to sharpen the member's own plan, and the visibility rules guarantee no affiliation ever sees them.
- Workforce boards: members can say they work with a board, and the area brief gives boards and members anonymous status of NextChapter members, layoffs, hiring, news and funding.
- The daily pop-up reads the search pattern; the phone bar follows the situation; employer funnels appear on Privacy; active vs casual is collected and used.

**Done since**
- Landed moves to Managing your career automatically 90 days after landing (daily job, `src/lib/journey/auto-advance.ts`).
- Win-back: members with no login or page activity for 21, 42 and 63 days get up to three emails, then nothing. Returning resets the count; members on leave are skipped (`src/lib/winback`).
- Board area counts use the member's county, found from their city through the cached Census place list. A board sees its own area when at least 10 members live there, and the state otherwise, labeled either way.
- Board briefs are drafted monthly into the mailing queue as drafts only. You approve the text and choose the readership; nothing is sent automatically.

**Still open**
- Company-level wages are matched to a role by word, since filings name occupations, not titles.
- Database changes (all applied to production): `prisma/manual/2026-10-13-growing-journey.sql`, `2026-10-13-conversations-and-boards.sql`, `2026-10-14-journeys-culture-winback.sql`.
- Members whose city is not yet in the cached place list count in the state, not the area, until the monthly board job looks the city up.
