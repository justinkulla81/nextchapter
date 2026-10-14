# NextChapter — Personal Job Assistant

Version 0.1 — design draft. Working name: **NextChapter Assistant** (the persona is Victoria; see §3). Not built yet.

The category is the "AI career companion" (Muse, Instinct, Fambot and similar): an app that works the job search *with* you every day, not a dashboard you visit. This draft assumes that reading of those products; adjust if you meant something narrower.

---

## 1. The idea in one paragraph

Most of what an assistant needs already exists in the portal: Victoria (coach persona and chat), the daily "one thing" action, Weekly Search Sprint, Gmail and Calendar tracking, the Find My Job tracker, the Chrome capture extension, and the Market Reality Grade. What's missing is a **companion surface**: something on the phone and in the inbox that reaches the candidate, does the tedious parts, and asks for one decision at a time. So we build a thin, mobile-first client over the existing data, not a second product with its own brain.

## 2. Standalone and in concert — one account, two depths

| | Standalone | In concert with the portal |
|---|---|---|
| Who | Someone who wants help, not a dashboard. Signs up in the app. | Existing portal candidate, or standalone user who grows into it. |
| Sign-in | Same Supabase account | Same Supabase account |
| Data | Same `CandidateProfile` and tracker tables | Same |
| Gets | Today, Pipeline, Drafts, Ask Victoria, Prep | All of that, plus Hireability Report, Dossier, References, Network, Coach and Recruiter views, Circle |
| Deep work | Hands off to the portal by link ("Open full report") | Portal hands back ("Do this on your phone") |

**Rule:** the assistant never holds data the portal can't see, and the portal never holds a task the assistant can't surface. "Standalone" means *usable without opening the portal*, not offline or backend-free. A truly local-first app would fork the data model and lose the grade, coach and recruiter loop. Recommend against it.

**Onboarding for standalone:** resume drop, one situation question, target role and location, connect Gmail (optional). Reuse the first four onboarding steps; defer assessment, contract, and references. Score reveal comes later, as a payoff, not a gate.

## 3. Persona

One persona, not two. The assistant **is Victoria** (`VICTORIA_VOICE_PROMPT`, `computeDirectnessLevel()`), warm and direct, never cheerleading. A second named bot would split trust and double prompt maintenance.

## 4. Core loop

1. **Capture** — jobs and activity arrive without typing: Chrome extension "Save this job", share-sheet or forwarded email (`applied@`, see IDEAS.md), Gmail tracking, calendar tracking.
2. **Decide** — Today shows **one** primary action (`src/lib/daily/primary-action.ts`), with a short "also waiting" list.
3. **Act** — the assistant drafts: follow-ups, thank-yous, warm-intro asks, tailored resume bullets, interview prep. The candidate approves, edits, or skips.
4. **Learn** — outcomes (interview, rejection, offer) update the pipeline, the grade, and next week's sprint.

**Autonomy line:** the assistant proposes and drafts; **a human approves every outbound message.** No auto-send in v1. Respect Confidential Search Mode: it blocks corporate-looking Gmail connections and must also suppress any employer-visible footprint.

## 5. Screens (5 tabs)

| Tab | Purpose | Primary action | Built on |
|---|---|---|---|
| **Today** | The one thing, plus what's waiting | Do the one thing | `primary-action.ts`, `DailyCheckIn`, sprint |
| **Pipeline** | Every role by stage, with next step and staleness | Add a job | Find My Job tracker, `TrackedEmailActivity`, `CompanyApplicationOutcome` |
| **Drafts** | Queue of assistant-written messages awaiting approval | Review draft | New `AssistantDraft`; follow-up rules from IDEAS.md |
| **Ask Victoria** | Chat grounded in the whole search | Send message | `CoachConversation`, `generate-reply.ts` |
| **Prep** | Per-interview brief: company, people, likely questions, practice | Start practice | `interview-prep`, `CompanyIntel`, `activeJobDescription` |

Profile and settings sit behind an avatar, not a sixth tab.

## 6. Capabilities and where they come from

| Capability | Exists today | New work |
|---|---|---|
| Daily plan | Yes (`daily/`, `weekly/sprint.ts`) | Expose as API |
| Job capture | Extension (CRM only), Find My Job | Candidate-scoped capture token; forward-email parser |
| Application tracking | Gmail classifier, calendar sync | Auto-advance pipeline stage from classified email |
| Follow-up drafting | Spec only (IDEAS.md) | Rules engine: 7 business days after interview, one follow-up max |
| Warm-intro finder | Support Network contacts exist | Match company on job add |
| Interview prep | Text practice and evaluation | Per-interview brief assembled from calendar event |
| Resume tailoring | Resume analysis and updater spec | Per-job variant, human approved |
| Push | Email only (SMS deferred, cost) | Web push via PWA; email fallback |

## 7. Architecture

- **Client:** installable PWA (Next.js, same repo, `/assistant` routes) with web push. Cheapest path to the phone, no store review. Native wrapper later only if push reliability on iOS proves insufficient.
- **API:** server actions and route handlers over existing `src/lib/*` modules. No parallel business logic.
- **Capture token:** scoped, revocable, hashed, same pattern as the CRM extension token; candidate-owned.
- **New tables (proposed):** `AssistantDraft` (kind, jobId, body, status, approvedAt), `AssistantPushSubscription`, `AssistantEvent` log if PostHog alone isn't enough.
- **LLM:** existing `@anthropic-ai/sdk` usage; drafts written with the Victoria voice prompt. Candidate content is not used to train or shared across candidates.
- **Next.js caveat:** this repo's Next.js version differs from common knowledge (see `AGENTS.md`). Read `node_modules/next/dist/docs/` before writing routes.

## 8. Design-principle check (`design-principles.md`)

- One primary action per screen — table in §5.
- 2–4 choices as adjacent buttons: draft review is **Send / Edit / Skip** (Send is the single accent green; nothing else uses it).
- Busy cursor and visible feedback on every action: reuse `SubmitButton`, `InlineLoadingState`.
- Destructive actions (delete job, discard draft) require confirmation and never default focus: reuse `ConfirmActionButton`.
- Empty, loading, error states for every list: reuse `EmptyState` and skeletons. Pipeline empty state teaches the three ways to add a job.
- Never disable without explaining: "Send" disabled only with inline reason (e.g. "Connect Gmail to send from your address").
- Sentence case, action-named buttons ("Send follow-up", not "Submit").
- Mobile: touch targets of at least 44 px, base text at the existing 18 px, AA contrast. Keyboard and accessible labels throughout.
- Grade colors only from `GRADE_TEXT_COLOR`.

## 9. Analytics (PostHog, per CLAUDE.md)

Client `posthog.capture()` unless noted. All include `candidateId` via identify, plus the params shown.

| Event | Params |
|---|---|
| `assistant_installed` | `platform`, `source` (standalone / portal prompt) |
| `assistant_signup_completed` (server) | `entry` (standalone / portal) |
| `today_action_completed` | `actionKey`, `source`, `secondsToComplete` |
| `today_action_skipped` | `actionKey`, `reason` |
| `job_captured` | `jobId`, `source` (extension / forward / manual / gmail) |
| `pipeline_stage_changed` | `jobId`, `from`, `to`, `trigger` (user / email / calendar) |
| `draft_generated` (server) | `draftId`, `kind`, `jobId` |
| `draft_sent` / `draft_edited` / `draft_skipped` | `draftId`, `kind`, `editedChars` |
| `interview_brief_opened` | `jobId`, `hoursBeforeInterview` |
| `coach_message_sent` | `surface` (assistant / portal) |
| `push_permission_resolved` | `result` |
| `handoff_to_portal` | `fromScreen`, `target` |

Key questions these answer: does standalone convert into portal use, which drafts get sent unedited (trust signal), and does the assistant shorten time from interview invite to prep opened.

## 10. Phases

0. **Shell** — PWA install, auth, Today tab on `primary-action.ts`, push opt-in. (Smallest thing that earns a home-screen icon.)
1. **Capture and Pipeline** — candidate capture token, extension mode, forward-email parser, auto-staging from Gmail.
2. **Drafts** — follow-up and thank-you rules, approval queue, warm-intro matching.
3. **Prep** — calendar-triggered interview briefs, voice practice (v2 per IDEAS.md).
4. **Monetization** — only after a first paying customer exists (Stripe is not built; everything is free today).

## 11. Open decisions

1. **PWA vs native app** — recommend PWA first; native only if iOS push is a real problem.
2. **Is standalone a separate acquisition funnel** (own marketing page, own App Store presence) or just a lighter door into the same signup? Affects the name and onboarding.
3. **Free or gated?** Coach chat gating is already an open item in IDEAS.md; the assistant makes it more pressing.
4. **Auto-send, ever?** v1 says no. Revisit only with measured draft-unedited rates.
5. **Name.** "NextChapter Assistant" is a placeholder; Victoria's brand may be stronger.
6. **Notification channel cost:** web push is free; SMS (Twilio) stays deferred.
