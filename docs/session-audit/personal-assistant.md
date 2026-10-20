# Audit: the personal job assistant ("Vic") against the candidate redesign

Read-only audit, 2026-10-18. Nothing was run. Sources: the spec on branch
`origin/claude/peaceful-ride-8ib5z2`, the redesign docs on this branch, and a grep of `main`.

## 0. Where it lives: merged vs branch only

| Thing | State |
|---|---|
| `docs/specs/NextChapter_Personal_Job_Assistant.md` (216 lines, v0.3 + section 14 "Ideas for helping candidates land, by journey") | **Branch only.** `origin/claude/peaceful-ride-8ib5z2`, 4 commits ahead of main, one file added, no code. Not in main, not in this redesign branch. (A plain `git diff origin/main origin/<branch>` shows 1,406 files because the branch is stale; the three-dot diff is the one spec file.) |
| Any assistant code (`/assistant` PWA, `AssistantDraft`, `AssistantMemoryFact`, `AssistantPermission`, `RunwayProfile`, `IntroRequest`, push) | **Does not exist** anywhere. Grepping all 50 remote branches for "assistant" in file paths finds only the spec. |
| Victoria, the AI coach | **Merged.** `src/lib/victoria.ts` (name varies: Victoria, Vicki, Vic by context), `src/lib/coach/generate-reply.ts` (Anthropic reply to a daily check-in), `VICTORIA_VOICE_PROMPT`. |
| Daily "one thing" | **Merged.** `src/lib/daily/primary-action.ts`, `src/lib/job-search-daily/build.ts` (daily email), `send-daily-action-email.ts`, midweek check-in, week-1 kickoff, finish-line, `src/lib/coach/weekly-digest.ts`. |
| Apply kit | **Merged.** `src/lib/jobs/apply-kit.ts`, `src/components/jobs/ApplyKit.tsx`. Templates, no AI: copy-ready answers (why this company, years, pay, start date, work authorization, relocation, travel). |
| Native apply | **Merged, narrow.** `src/lib/jobs/native-apply.ts`: one-click send only for jobs posted on NextChapter by an employer or recruiter. Crawled jobs always go to the employer site. |
| Gmail and Calendar | **Merged.** `src/lib/google/` (OAuth, `gmail.ts`, gmail-push route), `src/lib/calendar-tracking/` (classifies events, syncs), `meeting-notes.ts`. This is the "observe" layer the spec wants (level 0). |
| Negotiation | **Merged, small.** `src/lib/negotiation/evaluate-counter-offer.ts`. |
| Chrome extension | **Merged, but admin-only.** `extension/` is the CRM capture tool (token pasted, unpacked install). `IDEAS.md` says the member autofill extension ("Fill with NextChapter", never clicks submit, skips EEO) was approved 2026-10-16 and then parked: it needs a Chrome Web Store account and review. The spec's "candidate-scoped capture token, same pattern as the CRM extension" would reuse the admin pattern, which IDEAS.md rejects for members (unpacked, no auto-update). |
| Forward-an-email parser, auto-staging from Gmail, ghost follow-up, interview brief | **Ideas only.** In `IDEAS.md` (forwarding parser, "verifiable proof of outreach") and in the spec. `src/lib/coach/pre-session-brief.ts` exists but is a coach-side brief for coaches, not a candidate interview brief. |
| Autopilot / auto-apply | **Not built and not proposed.** The spec deliberately says "Quality over volume, matching the platform's stance on mass-apply". Nothing in the repo applies for a member without a click. |
| `src/lib/personalization/blocker-step.ts` (what gets in the way changes step 1 of the week) | Built, not wired (waits on `plan.ts`, per `docs/what-you-asked-for.md` row 30). This is the nearest thing to the assistant's "reason" engine for Home. |

## 1. What it is (the spec's ideas)

**Thesis.** A portal is a place you visit. An assistant acts for you, remembers you and reaches you
(email, push, share sheet, voice). The portal stays the deep workspace and source of truth.

**Core mechanics.**
- Authority ladder, per capability, default Draft: 0 Observe, 1 Suggest, 2 Draft, 3 Do with one tap, 4 Do alone inside rules. v1 ceiling is level 3; level 4 only for rule-bound reversible things (auto-decline recruiters below the candidate's own written criteria; calendar holds). Money, legal terms and first contact with an employer stay at 3. Confidential Search Mode overrides everything.
- Memory the candidate can see, edit, delete ("What Victoria knows about me"), each fact with source and date, stale ones re-confirmed.
- Five pillars: Job, Learning, Network, Work (income before the job), Money.
- Free to candidates. Money from employers, colleges, boards, recruiters (permissioned inbound, neutrality rule). Not recommended: income-share, selling data, paid placement.
- Phases: 0 shell + Today; 1 capture + pipeline; 2 drafts; 3 money; 4 assistant-to-assistant intros + bridge income; 5 interview-day + offer review.
- Open: coach marketplace fit, pre-registered outcome comparison, native apps.

**Section 14: ideas by journey.** Cross-journey, best first:
1. Hidden-market radar with a warm path (company signals, then "you know X there", three-line note).
2. Reply-first inbox (drafted reply to every recruiter email, plus the decision it needs).
3. Ghost resolver (second channel, one follow-up max).
4. One-tap posting packet (honest fit, gap, résumé variant, who you know, pitch).
5. Ex-employee door-openers (double opt-in).
6. Rejection-to-targeting loop (change the plan when a pattern shows).
7. Interview rehearsal by voice.
8. Reference concierge.
9. Runway-aware pacing.

Per journey (spec lists 8; the repo now has 11, see section 4): laid off (first 72 hours, laid-off cohort),
confidential (stealth mode), thinking about a move (market-value monitor), promotion (win log, case),
career change (vocabulary rewrite, people who switched), student (alumni asks), returning (gap story),
next act 55+ (portfolio plan). Stage rules: applying = cap volume; interviewing = brief, debrief, thank-you;
offer = compare, counter; landed = first 90 days.

**Built vs spec, in one line:** the data feeds exist (Gmail, calendar, daily email, apply kit, company signals,
likely openings, support network); the actor (drafting, approval queue, memory, permissions, push) does not.

## 2. Where it fits the redesign

Principle: the assistant is not a place or a tab. In the redesign it is a **layer** that (a) chooses and
words the one note on Home, (b) fills the weekly plan, (c) produces drafts that appear inside the existing
working pages, and (d) writes the receipts. It has no menu entry of its own.

| Spec idea | Place and entry in the redesign | Layer |
|---|---|---|
| Daily "one thing" | Home, Your week: **the one note** | Note driver |
| Memory ("what Vic knows") | Account and privacy; shown read-only as "change" everywhere else. Same rule as "one home per fact" in `bundles.md` | Cross-cutting store |
| Permissions / authority levels | Account and privacy, a new "What your assistant may do" tab (or inside Privacy). Defaults to suggest/draft | Cross-cutting |
| Reply-first inbox, recruiter triage | Network, Recruiters (`/dev-preview/network/circles/recruiters`) plus Network, Messages. Draft shown on the row, one action: Send | Draft |
| Ghost resolver, follow-ups, relationship upkeep | Network, This week (replaces `/dashboard/network/follow-ups`, which is "buried") | Draft + note |
| Warm intro, backchannel, ex-employee door-openers | Network, strip "Warmer introductions" (N1 receipt kind C); Jobs row action "Who can help you get in" | Draft |
| Assistant-to-assistant intros | Network, People you know / Alumni and groups. Later phase | Feature |
| One-tap posting packet | Jobs, My jobs and Find a job detail, next to the existing apply kit | Draft |
| Hidden-market radar | Jobs, Find a job: not posted yet (`/dev-preview/jobs/find/unposted`) and Companies | Feature (data exists: likely openings, company signals) |
| Auto-tracked pipeline | Jobs, My jobs. Gmail replies move the stage | Observe |
| Rejection-to-targeting loop | Home, Improve your search + the stalled Today (`/dev-preview/home/stalled`): "widen the search" | Note driver |
| Gap-driven micro-learning | Learn, Skills and courses; blocked until `CourseSkill` has rows | Feature |
| Interview brief, voice debrief, rehearsal | Jobs, Interviews | Draft + moment |
| Reference concierge | Network, People you know (references) | Draft |
| Offer review, counter script | Jobs, Offers | Draft |
| Runway, benefits navigator | Finances and benefits (opt-in only) | Feature |
| Runway-aware pacing | Home, Your week: weekly target resizes (bundle H4) | Note driver |
| Bridge income matcher | Jobs, Find a job: independent work | Feature |
| Promotion win log | Jobs, Offers and raises; Learn, Career story | Feature |
| Day-1 laid-off checklist | Moments, Your first week (`/dev-preview/moments/first-week`) | Note driver |
| Stealth mode | Account and privacy, What recruiters see; Confidential mode | Rule |
| Channels: push, email reply, share sheet | Weekly email (`/dev-preview/moments/weekly-email`), daily email | Delivery |
| Receipts | `/dev-preview/flows/receipt-*` | Writer |

**The three redesign surfaces it drives**
- **One note on Home.** Today the note is a rotating message; `bundles.md` says H3 ("what drives you") is meant to make it personal and the owner said Victoria's replies now mean "the one note on Home". The assistant is the engine that picks which single thing wins today.
- **Build your plan strip.** H2 blocker, H3 motivation, H4 time, H5 weekly check-in are exactly the inputs the assistant needs. They are also its memory seeds.
- **Weekly plan and receipts.** The assistant fills the week's steps; the receipt says what changed because of an answer. Both are the same "reason" object (see section 6).

## 3. Conflicts

1. **"Ask Victoria" tab and "What Victoria knows about me" (spec section 5, 9).** Victoria is set aside ("we can figure out what to do with her after"). A chat tab is a second place to ask and an extra top-level surface. Drop the tab and the name; keep the memory idea under Account and privacy with neutral wording. The spec's "Vic" naming (section 13) also conflicts: it extends the Victoria persona to a new product. Defer naming.
2. **Tabs "Today · Pipeline · Drafts · Ask Victoria · Money & Work" and a separate PWA at `/assistant`.** The redesign has seven places and says Home carries the only note. A second app with its own Today is a second note. Drafts, pipeline and money must appear inside Network, Jobs and Finances and benefits, not in a parallel shell.
3. **Proactive push on many events** (reply received, posting match, benefit deadline, nudges before ties decay). The decision is one note, and "daily messages, prompts, nudges... are one card in one place". Every proactive item must be eligible for the one note, not stack beside it. A push is allowed only as the delivery of that same note.
4. **Money pillar by default.** The spec's Money pillar (runway, benefits, "runway-aware pacing", "severance review") treats money as always on. The redesign says money is opt-in and "no" switches all of it off. Runway-aware pacing and minimum-pay filters may use money data only when moneyHelp is on. The assistant must not infer money stress from anything else.
5. **Authority "Do alone" (level 4)** and "adding calendar holds". Nothing else in the redesign acts without a click. Also conflicts with "no mass apply". Hold at level 3 until measured.
6. **Counts and urgency.** "Runway... 11 days", "Reply within minutes", a "volume-and-quality target" and "no urgency we didn't compute" fight "always positive". The redesign rule: every claim says why and is framed as progress. Phrase deadlines as the next helpful step.
7. **Rejection-to-targeting** ("four of six stalled at the hiring-manager screen") is a negative statistic. Rewrite as "pitch practice will help most this week, because...".
8. **Peer comparison** ("interview and offer rate for assistant users vs portal-only") is internal measurement only. Fine if never shown to candidates (no leaderboards, no badges).
9. **New cards.** Adding Drafts, Pipeline, a memory page and permissions page each triggers the rule "a change that adds a card, tag, toggle or section must say what it removes". Each item in section 6 names what it replaces.
10. **Dark navy** is reserved for one unlock moment per page. Assistant moments (interview-day card, offer mode) must not claim it.
11. **Link rule.** Any reference to routes in the spec's replacement docs should use the full `https://launchyournextchapter.com/...` URL.
12. **Free forever vs membership.** `/dashboard/membership` exists with paid tiers. The spec's "free to every candidate" needs a check against Candidate+ and membership, which are the one unlock ladder.

## 4. Old or does not fit

- **Spec says "eight journeys, seven stages".** The repo and audit now have 11 journeys (`journeys.md`, mockups include entrepreneur, time off, career change, fractional). The redesign has **no stage stepper**; the spec's stage-level rules and "stage already exists with a 90-day check-in" lean on stages. Rebase on journeys + time-in-search.
- **"Six places"** in the spec's tab list predates the seven-place menu, and "Money & Work" tab is now Finances and benefits (opt-in) plus Jobs, independent work.
- **Question 14 ("ninth journey")**: moot. Veteran, freelancer-returning and visa-clock are not among the 11; visa-clock fits J6 Requirements (work authorization) as a rule, not a journey.
- **Business-model section (7)** (recruiter pay-to-reach, intro fees, funded-learning referrals, anonymized intelligence). Not part of candidate redesign; belongs to partner portals. The highest-risk item (funded learning referrals) conflicts with "every claim says why" unless it never sorts by payout.
- **Autopilot / native apps / SMS / WhatsApp / voice channel in phase 0.** Not before the web note works. Native apps are an open question; PWA push is optional.
- **Section 9 reuse list** (`GRADE_TEXT_COLOR`, grades) leans on the grade system; the redesign is moving to progress, no badges.
- **Chrome extension via capture token.** Superseded by the IDEAS.md member autofill plan (Web Store, short-lived token, never click submit).
- **`daily/primary-action` as "existing"** is true, but it is the old daily surface; the new Home note replaces it.
- **Models `AssistantDraft`, `AssistantMemoryFact`, `AssistantPermission`, `AssistantPushSubscription`, `RunwayProfile`, `IntroRequest`** were proposed before the redesign decided money fields live in one set (savings, severance, monthly need) shared with the career story pause what-if. `RunwayProfile` must be that set, not a new one.
- **Schema names in the spec** (`CompanySignal`, `LayoffCohort`, `MemberEmployment`, `CompanyWatchlistEntry`) were not verified; the spec itself says confirm each before building on it.

## 5. New ideas (not in the spec, fit the redesign)

1. **The note is the assistant.** One ranked list of candidate "next things", from all sources; Home shows the top one with its reason, and the weekly email shows the top three. Everything else waits. This solves the notification overload and honours one note.
2. **Every draft ends in a receipt.** "Sent. Dana is the third person at Acme you've reached; follow up Thursday." Receipts already exist as a design (kinds A to D); extend with kind E: "an action was taken".
3. **"Why" as a data field.** Each suggestion carries `reason` and `source` (e.g. "You said family is why", "You have 6 weeks of runway" only when money help is on). Powers "Why this fits", the note and the memory page from one object.
4. **Memory = the profile with receipts.** Do not build a separate memory store first. The existing profile fields plus dossier already hold what the assistant needs; the memory page is a read view over them with "change" links. Reduces duplication audited in `README.md` (city asked in 4 places).
5. **Coaching style sets the assistant's reach.** Pushed hard = more drafts surfaced and shorter nudges; casual = one thing a day; supported = same plus a supporter cheer. One setting, already decided.
6. **Supporter as approver.** For members who add a supporter (partner), the supporter can send the cheer that becomes the note on a rough day (existing supporters feature, effort-only).
7. **Draft quality as the trust signal**: draft sent-unedited rate and undo rate, per capability, drives when a capability may graduate from Draft to One tap. Show candidates only "you edited 2 of 5".
8. **Quiet mode.** If the weekly check-in is low, the assistant drafts nothing new and says so (bundle H5: "a low answer lightens the week").
9. **Use the existing apply kit as the posting packet's core.** The packet is apply kit + fit reason + who can help you get in + one draft; mostly assembled from merged parts.
10. **Dev-preview first** per the brief: build `/dev-preview/home/today` states for "draft ready", "reply needs a decision", "interview tomorrow", "nothing today" before wiring anything.

## 6. Incorporation steps (in order)

1. **Park the persona, keep the engine.** Decide: the assistant is unnamed in UI ("your plan", "your week") until the Victoria decision is made. Do not merge branch `claude/peaceful-ride-8ib5z2` as is; cherry-pick the spec into `docs/specs/` after edits (remove Ask Victoria tab, /assistant PWA, Vic naming; rebase journeys to 11; remove stages; mark money opt-in).
2. **Define one object: `Suggestion`** = `{id, kind, place, entry, headline, reason, source, primaryAction, draftId?, requiresMoneyHelp, requiresConfidentialSafe, expiresAt}`. All ideas above are producers of it. Pure functions over existing data first.
3. **Ranker for the one note.** Pick one `Suggestion` per member per day with a deterministic rule (blocker first, then due follow-up, then reply waiting, then a stalled-week widen, then time-driven playbook). Respect coaching style, check-in mood, confidential mode, moneyHelp. Wire `blocker-step.ts` once `plan.ts` is free.
4. **Dev-preview the Home states** (draft ready, decision needed, nothing today, low mood) and get a screenshot reviewed before real data.
5. **Merge the two readers into the note**: today's daily-email builder (`src/lib/job-search-daily/build.ts`) and the dashboard note use the same ranker output, so email, push and Home show the same single thing.
6. **Drafts that already have inputs**: (a) follow-up on a tracked application after 7 business days (inputs: My jobs + `unified-follow-ups`), (b) thank-you after a calendar-detected interview (`calendar-tracking`), (c) warm intro text from the "Who can help you get in" match. LLM-written, level 2: draft only, shown as a row action ("Review draft"), never sent for the member.
7. **Receipts for drafts** (kind E) using the same receipt component as the bundles.
8. **Permissions and memory pages in Account and privacy**: read-only view of what the assistant uses, per capability off/suggest/draft/one tap, delete my data. Default Suggest + Draft. Required before any inbox read beyond what Gmail tracking already does.
9. **Inbox-aware features** (reply-first, recruiter triage, ghost resolver) once step 6 data shows draft acceptance. Reuse Gmail push route and classification.
10. **Posting packet** inside Jobs row detail ("Why this fits" opens it).
11. **Later**: hidden-market radar in Find a job: not posted yet; gap-driven learning after `CourseSkill` is filled; runway-aware pacing and benefits only with moneyHelp; assistant-to-assistant intros; interview-day mode; member autofill extension (needs Web Store account); weekly email as the assistant's off-site channel.
12. **PostHog**, as the project rules require, from the first commit: `suggestion_shown`, `suggestion_acted`, `draft_created`, `draft_sent`, `draft_edited`, `draft_skipped`, `assistant_permission_changed`, `memory_fact_edited` (server events via `posthog-node` where only a Server Action fires). Params: `suggestionId`, `kind`, `place`, `source`, `jobId` or `contactId`, `editedChars`.

### What each addition removes (redesign rule)
- Drafts: replace "Follow-ups due (buried)" and the manual outreach log in This week.
- Permissions/memory: replace the six privacy switches (bundle N4) and scattered "what we know about you" cards.
- Posting packet: replace separate apply kit, fit card and "who can help" blocks on a job with one opened panel.
- Receipt kind E: nothing new on screen; it reuses the receipt.

## 7. Minimal first version of "the assistant" inside the redesign

**One sentence:** the one note on Home, chosen by a ranker with a stated reason, optionally carrying one ready draft.

**Scope**
- Home, Your week: the single note (headline, one reason, one primary button). Inputs: blocker (H2), what drives you (H3), time (H4), week of search, stalled flag, check-in mood, due follow-ups, calendar events. Output: "Follow up with Dana today" with the draft already written, or "Interview tomorrow: here is your one-page brief", or a widen-the-search step in week 4.
- Draft types: **follow-up** and **thank-you**, level 2 (Draft). Shown in the same note; Copy and Open in Gmail, no sending in v1. Edited-chars logged.
- Delivery: the same note appears in the daily email and the weekly email. No push, no PWA, no chat.
- Control: a line in Account and privacy, "What your plan uses", listing sources (profile, Gmail, calendar) with off switches. Confidential mode blocks drafts that touch an employer.
- Money: only if moneyHelp is on, and only as the reason line ("six months of cushion" style), nothing otherwise.
- Receipt: after acting, "Sent. You reached 3 people this week; this gets you 1 step toward Candidate+." Positive, one reason, no badge.

**Not in v1**: Ask-Victoria chat, a name for the assistant, level 3 or 4 actions, auto-apply, inbound recruiter triage, assistant-to-assistant intros, extension, SMS, memory editing beyond the existing profile "change" links.

**Success test (pre-register)**: note acted-on rate, drafts sent unedited vs edited, and weeks active; compare against the current daily email cohort before saying it improves outcomes.

## 8. Open questions for the owner
1. Keep "Vic" as a visible assistant name after Victoria is decided, or never name it?
2. Is the assistant allowed to read Gmail beyond the current tracking for v1 (consent copy needed)?
3. Free to every candidate: confirm against Membership and Candidate+.
4. Should phase 1 include the member autofill extension (needs Web Store account) or wait?
5. Is the spec branch to be merged, or its content rewritten into `docs/specs/` here?
