# NextChapter — Personal Job Assistant

Version 0.2 — design draft. Working name: **NextChapter Assistant**; the persona is Victoria. Not built yet.

v0.1 treated the assistant as a lighter client over the portal. That undersells it. This version starts from what a *personal agent* can do that a portal structurally cannot, and from the five outcomes that matter to a candidate: **a job, learning, network, work, money.**

---

## 1. Thesis

A portal is a place you go. An assistant is something that **acts for you, remembers you, and reaches you**. The portal can score, report and host content. It cannot notice that a recruiter replied at 9:40pm, draft the answer, ask a friend's assistant for an intro, and tell you your benefits run out in 11 days, all before you open an app.

So the assistant is not a mobile skin. It is the *operating layer* between the candidate and everything outside NextChapter (inbox, calendar, employers, benefits agencies, their own network), with the portal as the deep workspace and the source of truth.

## 2. What only an assistant can do

| Attribute | Portal limit | Assistant behavior |
|---|---|---|
| **Proactive** | Waits to be visited | Initiates on events: reply received, interview tomorrow, posting matching a watchlist company, benefit deadline |
| **Acts on your behalf** | Can only show you things | Drafts, schedules, files, applies and follows up in *your* inbox, calendar and forms, within permissions you set |
| **Persistent memory** | Page-level state | Remembers what you said in March (hates sales roles, needs $X/month, can't relocate) and applies it everywhere |
| **Lives where you are** | One URL | Push, email reply, text, share sheet, browser overlay, voice; you can answer by replying to a message |
| **In-the-moment** | Async | 20 minutes before an interview: a one-screen brief. 5 minutes after: a voice debrief it turns into a thank-you and notes |
| **Represents you to others** | No standing | Screens inbound recruiters against your criteria, asks for intros, answers "is she open to this?" without exposing you |
| **Speaks agent-to-agent** | Humans only | Your assistant asks a contact's assistant "would you give 15 minutes?", with double opt-in, so asks cost nothing socially |

Each of these is a design test: if a feature works as well as a portal page, it doesn't belong here.

## 3. Five outcome pillars

Existing modules are in `code` style; what is new is in **bold**.

### Job
- Daily "one thing" (`daily/primary-action`), sprint, Gmail/Calendar tracking, Find My Job tracker, `likely-openings`, `company-tracker`.
- **Auto-tracked pipeline:** forward or share a posting; replies in Gmail advance the stage.
- **Follow-up that never forgets:** 7-business-day rule, one follow-up max, drafted and queued.
- **Inbound recruiter triage:** classifies outreach, checks fit against your criteria and comp floor, drafts a reply or a polite no.
- **Interview day:** brief before, voice debrief after, thank-you drafted.
- **Offer mode:** `negotiation` lib plus market comp data; live counter-offer coaching, with a human coach escalation.

### Learning
- `learning` courses, assessments, badges.
- **Gap-driven micro-learning:** reads a target posting, finds the 1–2 skills missing, serves a 15-minute lesson or practice inside the daily action instead of a course catalog.
- **Learn by doing:** converts a real task (a work sample, a pitch) into proof the candidate can show.
- **Funded learning:** matches the gap to programs a workforce board, college, or employer will pay for (`funding-opportunities`, `ScholarshipApplication`).

### Network
- `network` (5x5 support network), `OutreachLog`, `LinkedInConnection`, alumni groups, Circle.
- **Backchannel on every job:** "you know 2 people at this company" with a warm-intro draft (IDEAS.md).
- **Relationship upkeep:** nudges before ties decay, with a one-line reason to reach out.
- **Assistant-to-assistant intros:** double opt-in asks between candidates, alumni and willing contacts. This is the network-effect feature.
- **Verified outreach:** the assistant sees real sends via Gmail and the extension, closing the self-report gap noted in IDEAS.md.

### Work (income before the job)
- `interim-work`, `gig-directory`, `in-work`, interim marketplace signups.
- **Bridge income matcher:** surfaces interim, contract and gig work that fits skills and the hours you have; drafts the pitch; tracks it as income against your runway.
- **Work-that-helps-the-search:** prefers gigs that build target-role evidence or produce a reference.

### Money (access and runway)
- `benefits`, `benefits-network`, `funding-opportunities`, `ScholarshipApplication`, severance and layoff notice data.
- **Runway tracker:** a few inputs (savings, severance, benefit amount, monthly need) produce a runway date and an urgency setting that changes every other recommendation.
- **Benefits and aid navigator:** screens for unemployment insurance, health coverage windows, training funds, local assistance; tells you the deadline and the next step, and pre-fills what it can.
- **Severance and offer review:** flags what to ask about before signing; routes to a professional for anything legal.
- **Candid framing:** this is guidance and navigation, not legal or financial advice; every screen says so in plain words and offers a human.

## 4. Authority model

The assistant earns trust in steps. Every capability has a level the candidate controls, default **Draft**.

| Level | Meaning | Example |
|---|---|---|
| 0 Observe | Reads and learns | Reads Gmail to classify applications |
| 1 Suggest | Tells you what to do | "Follow up with Dana today" |
| 2 Draft | Writes it, waits | Follow-up email in Drafts |
| 3 Do with one tap | Executes after approval | Send, add to calendar, submit form |
| 4 Do within limits | Acts alone inside rules you set | "Decline recruiter outreach below $140k" |

Rules: nothing leaves your account at level 3+ without a record you can undo or review; level 4 exists only for low-stakes, reversible, rule-bound actions; anything involving money, legal terms, or a first contact with an employer stays at 3. Confidential Search Mode overrides everything and blocks any action visible to a current employer.

## 5. Memory

A per-candidate memory the candidate can see, edit and delete ("What Victoria knows about me"): stated preferences, deal-breakers, finances (opt-in), contacts' context, past outcomes. It feeds every prompt and is the main reason the assistant improves over weeks. Stored facts carry a source and date; stale facts are re-confirmed, not silently trusted.

## 6. Channels

Push (PWA) and email reply first; browser extension (candidate-scoped capture token, same pattern as the CRM extension); share sheet for postings; voice notes for debriefs. SMS/WhatsApp stays deferred until cost is justified (IDEAS.md). Every message is answerable in place ("Reply 1 to send, 2 to edit").

## 7. Business models it unlocks

The portal's model is B2B: employers, colleges, workforce boards, outplacement. The assistant adds revenue that doesn't depend on a sale to an organization first.

| Model | Who pays | How | Fit and risk |
|---|---|---|---|
| **Outplacement that doesn't expire** | Employers, colleges, workforce boards | Per-seat on layoff or enrollment, candidate keeps the assistant afterward | Directly hits LHH's "nothing durable for the candidate" weakness (Competitive Strategy). Low risk. **Lead here.** |
| **Outcome-linked seats** | Employers, boards | Part of the fee tied to verified placement and retention (the product already has outcome benchmarks) | Strong for government buyers; needs trusted measurement; slower cash |
| **Consumer subscription** | Candidate | Free core, paid for higher autonomy, more drafts, voice, coach review | Unemployed users are price-sensitive; keep the useful core free. Stripe isn't built. |
| **Assistant + human coach tier** | Candidate or sponsor | Assistant does the volume; a coach reviews weekly | Lets coaches serve far more clients; margin story |
| **Permissioned inbound for recruiters** | Recruiters, employers | Pay to reach candidates who opted in; assistant screens and the candidate only sees fits | New revenue and better candidate experience. Must never sell contact data or rank by who pays. |
| **Introduction fees** | Employers | Per accepted intro/hire (`BountyClaim`, `JobBoardIntroRequest` exist) | Already half-built; keep the fee paid by the employer, never the candidate |
| **Funded learning and aid referrals** | Training providers, funders | Providers or funders pay for qualified enrollments | **Highest conflict risk:** a vulnerable user must see the best-fit option, not the best-paying one. Disclose, never sort by payout. |
| **Network exchange** | Members | Credits for giving intros, referrals and reviews | Strengthens retention; needs moderation |
| **Anonymized market intelligence** | Boards, researchers | Aggregated, thresholded insights | Only with explicit consent and k-anonymity; fits `market-intelligence` |

**Not recommended:** income-share agreements or taking a cut of the candidate's pay (regulatory weight, misaligned with people in distress), selling personal data, and paid placement in what the assistant recommends to candidates.

## 8. Guardrails

- **Vulnerability:** users may be in financial distress. No dark patterns, no upsell inside the Money pillar, no urgency we didn't compute.
- **Honesty:** the assistant says what it did, what it could not verify, and when it is guessing. "I couldn't confirm your eligibility" beats a confident wrong answer.
- **Consent:** inbox and calendar access are separate, revocable, explained in plain words; disconnecting stops processing and offers deletion.
- **Third parties:** it only reads pages you're viewing; no scraping behind logins (LinkedIn terms).
- **Messaging law:** email and any future SMS need consent and an unsubscribe path.
- **Fairness:** matching and screening must not use protected traits or proxies; log why something was ranked.

## 9. Surface and architecture (condensed from v0.1)

Tabs: **Today · Pipeline · Drafts · Ask Victoria · Money & Work** (Prep appears on interview days as a card, and Learning/Network arrive inside Today and Pipeline rather than as tabs). One primary action per screen; Send/Edit/Skip as adjacent buttons; destructive actions confirmed. Reuse `SubmitButton`, `EmptyState`, `ConfirmActionButton`, `InlineLoadingState`, `GRADE_TEXT_COLOR`.

PWA in this repo under `/assistant`, same Supabase account, server actions over `src/lib/*`. Proposed new models: `AssistantDraft`, `AssistantMemoryFact`, `AssistantPermission` (capability, level), `AssistantPushSubscription`, `RunwayProfile`, `IntroRequest` (double opt-in). Read `node_modules/next/dist/docs/` first — this Next.js differs from common knowledge (`AGENTS.md`).

## 10. Analytics (PostHog)

Adds to the v0.1 list; client `posthog.capture()` unless marked server.

| Event | Params |
|---|---|
| `assistant_permission_changed` | `capability`, `fromLevel`, `toLevel` |
| `memory_fact_edited` / `memory_fact_deleted` | `factKind`, `source` |
| `recruiter_inbound_triaged` (server) | `outcome` (reply/decline/escalate), `matchedCriteria` |
| `intro_requested` / `intro_accepted` / `intro_declined` | `introId`, `via` (assistant/manual), `companyId` |
| `runway_set` / `runway_updated` | `runwayDaysBucket`, `source` |
| `benefit_screen_completed` | `programKind`, `eligibleCount`, `deadlineWithinDays` |
| `benefit_step_completed` | `programKind`, `step` |
| `gap_lesson_started` / `gap_lesson_completed` | `skill`, `jobId` |
| `bridge_gig_pitched` | `gigId`, `incomeEstimateBucket` |
| `offer_review_opened` | `jobId`, `escalatedToCoach` |
| `draft_sent` / `draft_edited` / `draft_skipped` | `draftId`, `kind`, `editedChars` |
| `voice_debrief_recorded` | `jobId`, `seconds` |

Measures that matter: draft sent-unedited rate (trust), time from interview invite to brief opened, intros accepted per request, and (the real test) interview and offer rate for assistant users vs. portal-only. Without that comparison we can't claim it improves chances.

## 11. Phases (ordered by leverage, not by ease)

0. **Shell and Today** — PWA, auth, push, daily action, memory v1, permissions page.
1. **Capture and Pipeline** — forward-email parser, candidate extension token, Gmail auto-staging, inbound recruiter triage.
2. **Drafts** — follow-ups, thank-yous, backchannel intros, approval queue.
3. **Money** — runway tracker and benefits/aid navigator (high value for the audience and a strong outplacement selling point).
4. **Assistant-to-assistant intros** and bridge-income matcher.
5. **Interview-day mode** (brief, voice debrief) and offer review.
6. Pricing experiments: employer seats first; consumer tier only after.

## 12. Open decisions

1. **Which pillar leads?** Recommend Job and Money first: Job proves the loop; Money is the differentiator with the buyer (boards, outplacement).
2. **Money scope:** navigation and deadlines only, or also pre-filling applications? Pre-filling raises liability and data handling.
3. **Recruiter-pays model:** are we willing to put a paid inbound channel next to a free candidate product, given the neutrality risk?
4. **Coach tier:** does the existing coach marketplace want assistant-leveraged coaching, or does it threaten their book?
5. **Autonomy ceiling:** is level 4 in v1 at all, or only after we have measured draft-unedited rates?
6. **Name:** keep "NextChapter Assistant" or lead with Victoria?
7. **Evidence plan:** pre-register the assistant-vs-portal-only comparison before launch so we can honestly claim outcomes.
