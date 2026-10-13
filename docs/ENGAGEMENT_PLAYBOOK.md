# Engagement playbook: journeys, stages, activities and why

How a member's situation maps to what they do, how we engage them at each point, and the reason for
each move. Written 2026-10-13 from the code. Where something is a recommendation and not built, it
says so. Companion docs: `CANDIDATE_STAGES.md` (generated), `CANDIDATE_MENU.md`, `AFFILIATIONS.md`.

## 1. Three questions, three settings

| Setting | Answers | Values | Set by |
|---|---|---|---|
| **Journey** | Why are you moving? | 8 (Laid off, Thinking about a move, Managing my career, Promotion, Career change, Student or new grad, Returning, Next act) | Onboarding card; Privacy; "I was laid off" |
| **Stage** | How close are you to applying? | 7 (Exploring, Preparing, Applying, Interviewing, Offer, Landed, Managing your career) | Onboarding timing; "Has anything changed?"; Privacy; Got An Offer |
| **Pace** | How hard are you looking? | Active or casual | Onboarding; Privacy |

The journey rarely changes. The stage changes as life does. Pace changes how fast and how hard we
push inside a stage. Everything we do reads all three.

**Why three, not one.** A laid-off person and a happy-in-their-job person can both be "preparing"
for very different reasons. A person doing fractional work and a person with no income can both be
"applying" with very different urgency. One setting would force us to treat them the same.

## 2. How journeys map to stages

`●` where the member starts. `→` the usual path. A member can move to any stage from "Has anything
changed?" or Privacy, so the table shows the expected path, not a rule.

| Journey | Starts at | Usual path | Common side moves |
|---|---|---|---|
| **Laid off or let go** | ● Applying | Applying → Interviewing → Offer → Landed → Managing your career | Back to Applying if the new job ends; Managing your career if they choose interim work and stop looking |
| **Thinking about a move** | ● Exploring (Preparing if they plan to apply within 1 to 3 months; Applying if "now") | Exploring → Preparing → Applying → Interviewing → Offer → Landed → Managing your career | Back to Managing your career if they decide to stay; "I was laid off" flips the journey to Laid off at Applying |
| **Managing my career** | ● Managing your career | Managing your career → (when ready) Applying | A promotion or a raise is a win inside this stage, not a stage change; "I was laid off" flips to Laid off |
| **Going for a promotion** | ● Preparing | Preparing (menu: Managing your career) → Landed if promoted, or Applying if they go outside | Managing your career after the conversation |
| **Changing careers** | ● Exploring | Exploring → Preparing → Applying → Interviewing → Offer → Landed | Longer Exploring and Preparing than any other journey: the bridge steps take time |
| **Student or recent grad** | ● Preparing | Preparing → Applying → Interviewing → Offer → Landed → Managing your career | Often casual early (internships), active near graduation |
| **Returning after a break** | ● Preparing | Preparing → Applying → Interviewing → Offer → Landed | Interim or part-time work first (Work now), then a full-time search |
| **Planning the next act** | ● Exploring | Exploring → Preparing → Applying (for advisory, fractional or board roles) → Landed (first engagement) → Managing your career | Usually casual; "Landed" can happen several times as roles stack |

### What moves a member between stages

| Trigger | Change | Why this trigger |
|---|---|---|
| Onboarding: "When do you want to start applying?" | Now → Applying; 1 to 3 months → Preparing; later or curious → Exploring | Employed members should not be pushed to apply before they are ready, or ignored when they are |
| "Has anything changed?" (dashboard, Saturday email, college check-ins) | Ready → Applying; Interviewing; Offer; Landed; Managing my career; Laid off → Laid off at Applying | One question, asked everywhere, so a change in life is one click |
| "Turn on more tools" box | Same answers as above | A locked tool is the moment someone wants to change; the answer is right there |
| Got An Offer claim | Landed | The claim is proof they started |
| Outplacement seat | Laid off at Applying | The seat exists because they lost the job |
| A college reports "laid off" or "got a job" | Laid off / Landed (true everywhere) | Facts apply to every affiliation. A college's "no longer looking" does not change the stage: it is that college's status only |
| Check-in pace | Exploring monthly; Preparing every 2 weeks; Applying, Interviewing, Offer weekly; Landed quarterly; Managing monthly | The pace of change is the pace of asking |

**Recommendation, not built:** after the first 90 days in a new job, move Landed to Managing your career
automatically. Today it needs one click, and some members will stay in Landed. The 90 days are the right
window: the first-90-days plan ends and the career plan begins.

## 3. Buckets of activity

Eight things a person does in a search, plus two stage-specific menus. The scoring system groups the
same work into four weekly engines (the grade's effort input): **Networking** (outreach, references,
community), **Learning**, **Working** (assets that exist: résumé, work samples, active LinkedIn) and
**Effort** (interview prep, setup confirmations). One point is one minute of effort.

| Bucket | What it is | Why it matters | Weekly engine |
|---|---|---|---|
| **Personalize** | Know yourself and your market: strategy, profile, assessments, Market Reality Report, your local market | Everything else is tailored from it; a plan built on a guess fails | Effort |
| **Prove it** | References, portfolio and Dossier, résumé, marketing plan (LinkedIn) | Claims do not get hired; evidence does. This is also what unlocks A-List jobs, the Offer Bonus and recruiter visibility | Working |
| **Search and apply** | Find and fit-check roles, companies, interview prep, offers and negotiation | The part everyone expects, and the part that fails first if the others are skipped | Effort / Working |
| **Network** | Contacts, outreach, follow-ups, community, recruiters, colleges, workforce boards | Most roles are filled through people; it is also how a search stays human | Networking |
| **Learn** | Skills, courses, certificates, videos | Closes the gaps the market shows; keeps skills fresh through a downturn | Learning |
| **Coaching** | AI coach (Victoria) and human executive coaches | Someone who sees the whole picture and says the hard thing | Networking |
| **Work now** | Interim, fractional, advisory, board, EQoverIQ | Income and proof while searching; the main path for a next act | Working |
| **Support and settings** | Stats, benefits and financial bridge, I'm Struggling, membership, help, privacy | A search is hard; people who can't get through the week stop | none |
| **Manage your career** *(Managing your career, Landed)* | Know your worth, build your case, prove results, skills, hard conversation, first 90 days | Most people are employed most of the time; this is where NextChapter earns trust before and after the search | Working / Learning |

## 4. Specific activities by bucket

Points are minutes of effort from `src/lib/weekly/action-effort.ts`. "Stages" is where the activity is
strongest.

### Personalize
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Set your Search Strategy (goals, target role, industries, comp, deal breakers) | 35 | Exploring, Preparing | Targets drive matching, the report and the plan |
| Read your Market Reality Report; retake as things change | 0 | All | Honest baseline: where you stand and what is in your control |
| Take the Skills Assessment | 20 | Exploring, Preparing | Shows skills you have and the ones worth building; unlocks Learning |
| Take How I Perform (personality) | 20 | Preparing | Adds how you work to the Dossier |
| Complete Track Record | 20 | Preparing, Managing your career | Team, budget and scope are the facts a raise or a search rests on |
| Complete What I Need | 20 | Preparing, Offer | The work values you will not trade away: used when weighing offers |
| Confirm profile, industry, function, salary, work authorization | 5 each | Preparing | Cheap, and the plan and matching read them |
| Check your local market | 0 | Exploring, Applying | Layoffs, hiring and other members near you: you are not alone, and where to aim |

### Prove it
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Fix résumé issues with the Résumé Fixer | 30 | Preparing, Applying (gate at week 3) | The first thing a recruiter or applicant tracking system trips on |
| Request references (target 3) | 5 each | Preparing, Managing your career | Third-party proof is the strongest thing in a Dossier |
| Complete a reference | 30 | Preparing, Interviewing | Counts only when someone else vouches |
| Add a work sample with a before and after | 5 grade bump | Preparing, Managing your career | One number beats a list of responsibilities |
| Approve a reference quote | 0 | Managing your career | Makes the proof usable in a conversation |
| Set up LinkedIn; publish a post | 20 each | Exploring (quietly), Preparing | Visibility on your terms; off by default while confidential |
| Core narrative and ways to say it | 25 / 20 | Preparing | Your story, said clearly once, reused everywhere |
| Build your case (ask, reasons, walk-away) | 0 | Managing your career, Offer | Turns facts into a conversation you can win |

### Search and apply
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Apply to a full-time job | 25 | Applying (not casual) | Volume, but only if it converts |
| React to a job recommendation | 2 | Applying | Trains matching on what you actually want |
| Add a company to your tracker | 2 | Exploring, Preparing | Targets before applications |
| Mock interview; behavioral practice | 30 / 15 | Applying, Interviewing | Interviews are a skill, and the cheapest one to improve |
| Attend an interview (logged from Calendar) | 25 | Interviewing | Proves the funnel is moving |
| Negotiation advice and practice | 20 | Offer | The largest single return on a few hours |
| Claim the Offer Bonus | n/a | Landed | Closes the loop and tells us it worked |

### Network
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Add contacts to your list (target 25) | 25 | Exploring, Preparing | A search starts with who you already know |
| Outreach message; coffee chat or call | 15 / 30 | All searching stages | Most roles are filled through people |
| Follow up; thank-you note | 10 each | Interviewing, Landed | The cheapest way to be remembered |
| Request or make an introduction | 15 | Applying | Warm beats cold |
| Post an update; comment; attend a community event; help a peer | 10 / 5 / 30 / 5 | Applying, Managing | A long search is lonely; peers keep people going |
| Connect Gmail and Calendar | 10 each | Day one | Activity counts itself, and Network, Jobs and Interim unlock |
| Connect LinkedIn | 25 | Day one | Warm introductions and your marketing plan |
| Work with a workforce board; college; recruiter | n/a | Applying, Preparing | Local help and funded programs |

### Learn
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Complete a course module | 20 | Exploring, Managing | The cheapest closing of a named skill gap |
| Start / complete a certificate | 5 / 40 | Preparing (career change) | A credential bridges a change of field |
| Start / complete a new tool; log an AI project | 5 / 15 | All | AI fluency is a visible, checkable signal now |
| Watch a webinar or video | 3 | Any | Low effort, keeps momentum |

### Coaching
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Talk to Victoria; daily check-in | 3 | All | The one who has read everything; tone set by you |
| Book a coaching session | n/a | Applying (gate at week 9), Managing | A person who sees what the data cannot |
| Pitch practice with a coach | 20 | Interviewing | Practice with feedback |

### Work now
| Activity | Pts | Stages | Why |
|---|---|---|---|
| Create an interim profile; explore interim roles | 10 | Preparing, Applying (gate at week 6) | Income and proof while you search |
| Get accepted, first project, first payout on a platform | 20 / 30 / 20 | Applying, Next act | Real work is the best evidence |
| Draft a board and advisory profile | n/a | Next act | The first step to portfolio work |

### Support and settings
| Activity | Why |
|---|---|
| Check runway and benefits (Benefits & Financial Bridge) | Decisions made with a clear head are better ones |
| I'm Struggling (988, therapists, EAP) | Never affects the grade; always there |
| Mood check-in | A drop in mood is a real signal and triggers support, not nagging |
| Privacy, Confidential Search Mode, who can see you | Trust is the condition for everything else |

### Manage your career
| Activity | Stages | Why |
|---|---|---|
| Know your worth (pay against advertised pay and public wage filings) | Managing, Offer, Landed | You cannot ask for the right number without one |
| Build your case, save your ask, record how it went | Managing | A raise is won before the room |
| Prove your results (Track Record) | Managing | Facts, not feelings |
| Build new skills | Managing | Skills that hold value are the best recession insurance |
| Practice the hard conversation | Managing | Rehearsal beats nerves |
| Plan your first 90 days; thank the people who helped | Landed | The relationships made now decide the next move |

## 5. Why we engage the way we do

Seven principles. Every move below follows from one of them.

1. **Proof beats promises.** The members who connect, get references and finish the Dossier get the most (A-List jobs, Offer Bonus, recruiter visibility). So we lead with the next piece of proof, and say what it opens.
2. **Show the next unlock, not the whole mountain.** One primary action per screen and per email. Three steps at most.
3. **Adapt to results, not the calendar.** A search that has run six weeks with no interviews needs a different move than one with three interviews and no offers. Time opens the gate; the pattern picks the move.
4. **New things, not louder things.** When a search stalls the plan changes (a teardown, wider targets, interim income, a coach, a different lane). Reworded reminders are noise.
5. **Respect the pace.** Casual searchers get a light plan, half-pace gates, half the points target and fewer nudges. Pressure on someone doing fractional work and open to the right thing drives them away.
6. **Say it the way they asked.** Tough love, gentle or a mix sets the wording of feedback, gates and unlock messages. Never punitive, never shaming, always one concrete next action.
7. **Privacy first.** Employed journeys are confidential by default. Mood and screening answers are never shared. Other members appear only as anonymous counts of at least 10.

## 6. The levers

| Lever | What it does | When | Reads | Why |
|---|---|---|---|---|
| **Weekly plan** | Auto-assigned each Monday: next unlock, stalled-search moves, journey and stage steps, then the general menu | Weekly and mid-week as things change | Journey, stage, pace, driver, results, screening answers, upcoming conversation | The plan is the product; everything else points at it |
| **"Get more from NextChapter" card and email block** | Up to three unlock steps with what each opens; or the stalled-search move | Dashboard always; Monday, Friday and Saturday emails | Connections, references, résumé issues, assessments, Dossier unlock, results | Members who connect and prove get the most |
| **"Has anything changed?"** | One question, seven answers, each is a change | At the stage's pace; Saturday email; college check-ins | Stage, last checked | Keeps the plan true |
| **Menu with show, locked, hidden** | Shows what helps now; mutes what a status change would turn on | Always | Stage | A hidden tool cannot motivate a status update; a muted one can |
| **"Turn on more tools" box** | Explains why tools are off; one-click status change | When tools are locked by status | Stage | The moment a locked tool is wanted is the moment to update |
| **Daily pop-up** | Mood, apply-today or network-today, a few times a week, never two days running | App open | Results, pace | Small commitments grounded in the real week. Stops asking for applications when applications are not working or the search is casual |
| **Stalled-search gates** | Different moves by pattern, from week 3 (week 6 if casual) | In the plan, card, emails and pop-up | Weeks in stage, applications, outreach, interviews, offers | New doors when the old ones are not working |
| **Tone** | Directness of Victoria and wording of nudges | Everywhere | Preference, tenure, pace | People ask for different pushes; honoring it is trust |
| **Points, weekly target, badges, grade** | Recognition for real effort; bounded nudge to the grade | Weekly | Completed actions, pace | Effort should be visible without being gamed |
| **Sentiment alert** | Support card when mood is low or falling | Dashboard | 14-day mood | A search is hard; the response to a low week is support, not volume |
| **Local market and anonymous member status** | What is filed, who is hiring, how other members are doing | "Your local market" | State, workforce board | You are not alone; where to aim |
| **Affiliations** | Colleges, coach, outplacement, boards, recruiters, employers | Per consent | See `AFFILIATIONS.md` | Help already around the member, without anyone seeing more than they chose |
| **Human coach** | Escalation when the data is not enough | Gate at week 9; Premium | Stage, pattern | Some problems need a person |

### Emails (who gets what)

| Email | When | Who | Why |
|---|---|---|---|
| Week 1 kickoff | Day 1 after registration | New members | Sets the tone and the first week |
| Registration reminder | Daily until done | Finished the assessment, never confirmed | The report is waiting |
| Daily action ("your one thing") | Daily | Active searchers (not casual, not managing/landed job emails) | One concrete step; reset framing after 3 days without a check-in |
| Monday "your new week is set" | Monday | All with a prior week | Last week, this week's target and plan, plus the unlock block |
| Midweek check-in | Midweek | Active searchers | Course-correct before Friday |
| Friday gap nudge | Friday | Active searchers behind target | Close the gap, plus the unlock block |
| Saturday "Has anything changed?" | At the stage's pace | All | Keeps the plan true; one click per answer |
| Sunday finish line | Sunday | All | Close the week on what was done |
| Market update | Weekly | All | Local market, one nugget |
| Job Search Daily, fresh job alerts | Daily / event | Searchers only (not Managing your career, not Landed) | Job listings are for people looking |
| Interim role check-in | Daily cron | Members with an interim role | Keep income and status honest |

## 7. Engagement by stage

For each stage: the goal, what we do, and why.

### Exploring
**Goal:** the member knows their market and their worth and has a reason to come back.
- **Do:** Market Reality Report first; compare pay; set goals; track companies; quiet LinkedIn; one conversation a month; skills assessment; show the local market. No application targets, no "apply" pop-up. Job tools visible but muted.
- **Engage:** monthly check-in; Monday plan; market update; unlock steps (connect Gmail and LinkedIn privately). If a layoff worries them: runway and benefits first.
- **Why:** pushing someone to apply too early makes them feel pressured and quit; ignoring them makes them forget. The useful middle is knowledge and small proof.
- **Avoid:** application volume; any message that implies their employer will find out.

### Preparing
**Goal:** the first application is already strong.
- **Do:** Résumé Fixer; three reference requests; Dossier and portfolio; target companies; LinkedIn and story; assessments; quiet conversations.
- **Engage:** check-in every two weeks; plan; unlock steps; casual members get the light plan.
- **Why:** this is where proof is built, and it is also where the A-List perks come from. Doing it before applying means every application benefits.
- **Avoid:** a long list. Three steps, each with what it opens.

### Applying
**Goal:** a search that converts, not just a search that is busy.
- **Do:** find and fit-check roles; outreach; follow-ups; interview practice; interim work; coach; learn while searching.
- **Engage:** weekly check-in; Monday, Friday and Saturday emails; daily pop-up (apply or network, by what is working); stalled-search gates at weeks 3, 6, 9, 13.
- **Why:** this is the stage with the most volume and the most frustration. Two failure modes: not starting (fix: first five messages) and busy without results (fix: change the move, not the effort).
- **Avoid:** more of the same advice at week 8; shaming; pressure on casual searchers.

### Interviewing
**Goal:** convert interviews to offers.
- **Do:** practice hard questions; keep references warm; research the company; thank-you notes and follow-ups; plan negotiation.
- **Engage:** weekly check-in; interview-prep steps; "interviews but no offers" gate (mock interviews, feedback requests).
- **Why:** the member is closest to the goal. Small improvements in how they close are worth more than any new application.
- **Avoid:** telling them to apply to more roles while they have live interviews.

### Offer
**Goal:** the member negotiates from evidence and decides well.
- **Do:** see the offer against the market (advertised pay and public filings); prepare the number, reasons and walk-away; weigh it against What I Need; keep references ready.
- **Engage:** weekly check-in; "Got an offer" flows to negotiation help.
- **Why:** the largest single return on a few hours of effort.
- **Avoid:** pushing the member to accept quickly.

### Landed
**Goal:** a strong start, and a member who stays.
- **Do:** tell us about the job (Offer Bonus); plan the first 90 days; thank the people who helped; know your worth in the new role.
- **Engage:** quarterly check-in; first-90-days plan; no job-listing emails; college alumni grace period starts.
- **Why:** landing is the moment of highest goodwill and the start of the next career. The people thanked now are the network of the next move.
- **Gap:** automatic move to Managing your career after 90 days (recommended, not built).

### Managing your career
**Goal:** the member keeps using NextChapter when not looking, and is ready if that changes.
- **Do:** know your worth; build your case and save your ask; prove results; build skills; practice the hard conversation; keep references, network and Dossier current (recession-proofing).
- **Engage:** monthly check-in; career plan; unlock steps; upcoming-conversation reminder; no job-listing emails. After a "not now" outcome: an offer to look at the market and to update status.
- **Why:** most members are employed most of the time. A product that disappears between searches has to re-earn trust each time. Being useful in a review or a downturn is the best reason to be there when the search starts.
- **Avoid:** treating them as lapsed; any nudge that assumes they want to leave.

## 8. Engagement by journey

| Journey | Hook in week one | Language | Watch for |
|---|---|---|---|
| **Laid off** | File for benefits, severance dates, tell 10 people, 20 target companies, a coaching session | Direct, practical, warm; never "since you separated" assumptions about the reason | Shame and isolation: lead with support and a plan, not a score |
| **Thinking about a move** | Compare pay, quiet LinkedIn, track 10 companies | Private, no-pressure; "quietly" | Confidentiality: nothing visible at work. The "worried about a layoff" answer puts runway first |
| **Managing my career** | Wins, review prep, pay benchmark, one skill | Growth and security; not "job search" | Do not nudge toward leaving |
| **Promotion** | Three wins, gap to the next level, pay for the next level | Leverage, evidence | Manager conversation timing; staying menu until they go external |
| **Career change** | Transferable skills, three target roles, an informational call | Bridge, proof | Long Exploring and Preparing: celebrate small steps |
| **Student or new grad** | First résumé, 10 employers, an alum call | Encouraging; "everyone starts without experience" | Alumni and college are the strongest lever; internships are casual |
| **Returning** | Two-sentence story for the break, refresh a skill, look at interim work | Gap as context, not flaw | Confidence; interim work is a legitimate first step |
| **Next act** | Board and advisory profile, 10 organizations, fractional roles | Portfolio of work, purpose | Usually casual; full-time ladder advice is wrong for them |

## 9. When people get stuck, disconnect or go quiet

| Signal | What we do | Built? |
|---|---|---|
| Not connected (Gmail, LinkedIn) | Lead every weekly email and the dashboard with what to connect and what it unlocks, in terms of what they are doing | Yes |
| Connected, not proven (few references, open résumé issues) | Next unlock steps; "members who prove their work get the most" | Yes |
| Search not started after a week | First five messages | Yes |
| Applications, no interviews | Week 3 Résumé Fixer; week 6 wider targets and interim; week 9 coach and a critique; week 13 a different lane | Yes |
| Interviews, no offers | Mock interviews, behavioral practice, feedback requests | Yes |
| Casual searcher quiet for weeks | Nothing pressured; Monday plan and Saturday check-in continue | Yes |
| Low or falling mood | Support card; I'm Struggling; tone stays gentle | Yes |
| No check-in in 3+ days | Daily email switches to reset framing | Yes |
| Account never confirmed | Daily registration reminder with a magic link | Yes |
| Dormant for weeks (no login) | Saturday check-in and Monday plan still go out; no dedicated win-back sequence | **No: recommended** |
| Conversation outcome "not now" | Offer to look at the market and update status | Yes |

## 10. How we will know it is working

Events that exist: `journey_changed` (with source and move driver), `journey_check_in_answered`,
`status_updated_from_menu`, `engagement_step_clicked`, `engagement_lead_emailed`, `career_conversation_saved`,
`career_conversation_outcome`, `workforce_board_connected`, plus the existing action, email and page events.

Proposed measures (not yet reported anywhere):
- **Activation:** share of new members who connect Gmail within 7 days; who request 3 references within 14.
- **Unlock steps:** click-through by step and by tone; connection rate after an unlock email vs without.
- **Stage health:** median weeks in Applying before the first interview; share who reach Interviewing by week 6.
- **Stalled-search gates:** of members who hit a gate, share who move stage within 4 weeks; compare casual and active.
- **Managing your career:** share of members who return in a month with no search; conversations saved; outcomes recorded.
- **Quality:** emails per member per week by pace (should be lower for casual); unsubscribe rate by email.

## 11. Recommendations not yet built

1. Move Landed to Managing your career automatically after 90 days.
2. A win-back sequence for members dormant for more than three weeks, by stage.
3. Report the measures in section 10 on one admin page.
4. Let members pick which day their weekly plan arrives (the current "action window" setting does nothing).
5. County for members (not just state) so a local board's brief can be more specific.
