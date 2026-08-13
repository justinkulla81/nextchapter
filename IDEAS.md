# Future Ideas

Backlog of ideas that came up in passing but aren't scheduled yet. Not a spec — just a place to not lose the thread.

## Marketing

- Replace the homepage "Feeling Stuck?" section's placeholder video with a real HeyGen (or similarly produced) explainer video of Vic and of real unemployed men and women, to humanize the emotional toll before the harder "what it takes" pitch. Needs a script, a voice/likeness for Vic, and either real people willing to be filmed or licensed footage — blocked on producing that asset, same as the logo. The placeholder slot (play-button + "Video coming soon" caption) is live now so the layout is ready to drop the real video in.

## Branding

- Swap the site logo (header/nav, footer, dashboard, onboarding, org pages — everywhere the shared `Logo` component renders) to the new wordmark + upward-arrow mark image, replacing the current plain-text "NextChapter" span. Also restyle the favicon (`icon.tsx`), apple touch icon (`apple-icon.tsx`), and OG image (`opengraph-image.tsx`) to match, since those are currently separate text/SVG generators, not derived from the shared `Logo` component. Blocked on: getting the logo file saved into the repo (e.g. `public/logo.png`).

## Coaching / Recruiting

- Calendar + Google Meet OAuth integration for coaches and recruiters — let a Coach or Recruiter connect their Google Calendar so session/call scheduling links can be generated and shared directly (e.g. from the Coach client accordion or a future Recruiter workspace), instead of coordinating times over email/text. Deferred: needs a real Google Cloud OAuth Client ID + Client Secret (none present in `.env.local` today), plus scope/consent-screen setup, which is real security/config surface separate from the rest of this batch — same reasoning as the deferred Google Sign-In item below.

## Auth

- Add real Google OAuth sign-in (Supabase provider config + account-linking against existing email/password accounts). Today auth is email/password + magic link only. This is a meaningfully separate feature — real security/config surface — from the rest of the app, so it's deferred rather than folded into unrelated batches. Once built, the nav should surface "Set up Google Sign-In" as an available activity until connected, then remove it from the nav (keeping "Single Sign-On" as a label until then).

## Network

- Verifiable proof of outreach, beyond self-report. Today "I reached out" (help script, outreach logging) is entirely self-reported — there's no way to confirm a message was actually sent. A real version would need something like an email/LinkedIn integration to detect real sends (a per-candidate BCC-tracking address is the cheapest first step; a Chrome extension detecting LinkedIn message sends is the fuller version), which is a meaningfully separate integration effort — deferred rather than folded into the Network page rework.

## Community

- Add a news-article feed to the merged Community page — curated job-market/career-news items interspersed with candidate posts and activity, to give the feed something to show even when candidate activity is quiet. Needs an actual content/curation pipeline (an editorial source or a news API), which doesn't exist yet — logged here rather than built as part of the Community+Circle merge.

## Interview Prep

- Bring back a candidate-facing "answer interview questions" feature (previously `/dashboard/interview`, the `InterviewResponse` model), but only once there's a real recruiter/coach on the other end of it — without an audience, candidates have no reason to volunteer written answers to a static question bank on their own. Re-introduce it as part of the recruiter/coach experience instead: let a recruiter or coach pick which questions they actually want answered (an "option bank" selection, not a fixed list), so the exercise has a concrete purpose and a real reader. Removed from nav/routing for now; the `InterviewResponse` and `InterviewQuestionBank` Prisma models were left in schema untouched so any historical responses aren't lost and the redesigned version doesn't have to start from scratch.

## Notifications

- SMS accountability nudges — let a candidate opt in to text reminders (in addition to email) for extra accountability, with a 5-point one-time bonus for opting in (mirroring the existing salary/work-auth confirmation bonuses) and copy communicating that at the decision point. The `smsPhone`/`smsConsentedAt` fields and `updateSmsConsent` action already exist from an earlier pass, but the opt-in UI (onboarding contract page, Communication Preferences settings) has been deactivated for now — no actual send integration exists, and Twilio itself costs real money (~$0.0079/segment for US SMS plus ~$1-2/month per phone number), so this is deferred until that cost is worth taking on. `SmsConsentForm.tsx` was left in place, just unreferenced, so re-activating is mostly wiring the UI back in once Twilio is set up and the point-bonus mechanism is built. WhatsApp Business API is a real alternative to plain SMS worth weighing at the same time — richer message format, but needs Meta business verification (1-4 weeks) and only allows unsolicited sends outside a 24-hour reply window via pre-approved templates.

## Dashboard

- Gate access to the Executive Coach (Victoria) chat behind the unlock-tier system, the same way The Circle is gated — right now it stays fully unlocked/visible on the dashboard for everyone since the gating logic doesn't exist yet. `TIER_UNLOCKS[1]` in `src/lib/community/unlock-tier.ts` already lists "coach chat" as a Tier 1 unlock, so this would mean either changing that copy to reflect a real higher-tier gate, or explicitly deciding coach access should stay free at Tier 1 and this idea is moot.

*(Removed: "My Stats" page — this was built. See `src/app/dashboard/stats/page.tsx`.)*

## Trust & Integrations

- Real company-email-domain verification for employers/recruiters. Today, anywhere an employer or recruiter self-submits something (NC Job Board postings, Employer Reference & Referral submissions), there's no check that the submitter's email domain actually belongs to the company they claim — see the shared trust-gate comment in `src/lib/employer-references/submission.ts` and `src/lib/jobs/job-board-submission.ts`. A named, real-looking contact (required name/company/work-email fields) is the trust gate instead of a real domain check. A real version would need something like a DNS/MX lookup or a paid company-verification API (Clearbit, Kickbox) — flagged rather than building a second, parallel verification system ad hoc.
- Live Attio CRM sync. The layoff-context branch of the Employer Reference flow (`src/app/for-managers/give-a-reference/submit/actions.ts`) stamps `attioSyncRequestedAt` on `EmployerReferenceSubmission` rows instead of actually calling Attio's API — there's no Attio client and no credentials configured anywhere in the app. The timestamp exists so a real sync job can sweep up every unsynced record once credentials are available, without losing any submissions in the meantime. Needs: an Attio API key, a client wrapper, and a cron or on-demand sync job that reads `attioSyncRequestedAt IS NOT NULL AND attioSyncedAt IS NULL` and calls the real API.

## Monetization

- Stripe payments — env vars (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) are configured in `.env.local` but there is no Stripe code anywhere in `src/` — nothing charges anyone today. Everything on the platform is free. When this gets built: Stripe Checkout for one-off paid coaching sessions, Stripe Subscriptions for a recurring coaching package, a webhook handler for subscription lifecycle events, and (later) employer-side subscription tiers for the Talent/Hiring Manager portal. Deferred until real paid-coaching demand is validated — don't build billing before there's a first paying customer.

## Job Search Tools (not built)

- **LinkedIn Audit Tool** — candidate pastes their LinkedIn URL (or, as a fallback that always works without scraping, pastes their About + headline text) and gets a structured audit: headline score (does it name function + level + a differentiator?), About section clarity, experience-bullet quantification ratio, skills relevance, Open-to-Work setting check, and 3-5 prioritized fixes. Distinct from the existing LinkedIn Post Generator / Thought Leadership Studio, which is about publishing content, not auditing the profile itself.
- **Culture Match Tool** — translate the candidate's existing 8-dimension Work Style Assessment into plain-language targeting criteria ("companies under 500 people tend to fit your profile better than enterprise," "you'll likely thrive with a player-coach manager"). Output is criteria a candidate can self-apply when evaluating roles, not a ranked list of specific employers — ranking real companies would need an employer data layer that doesn't exist yet.
- **Backchannel / Connection Finder** — when a job is added to the tracker (Find My Job), cross-reference the company name against the candidate's Support Network contacts (5x5 builder) to surface "you know someone at this company" and generate a warm-intro outreach message. The Support Network contact list already exists (`src/lib/network/`, `SupportNetworkContact` model); this would just be a new matching step triggered from job tracking.
- **Follow-Up Script Generator** — when a candidate has gone silent after applying or interviewing, generate one professional follow-up message with built-in timing rules (7 business days after an interview with no stated timeline; day after a stated timeline passes) and an explicit "don't follow up again after this" guardrail.
- **Job-application email-forwarding parser** — a dedicated inbound address (e.g. `applied@`) that a candidate forwards ATS confirmation emails to, auto-parsed into a Find My Job tracker entry (company, title, date). Cheaper first step toward automatic application tracking than the Chrome-extension route below; would reuse the same inbound-email pattern already built for Gmail-based Market Pulse ingestion (`src/app/api/google/oauth/`).
- **Chrome extension** for two related but separable use cases: (a) authenticated LinkedIn profile audit (sees everything the candidate sees, not just the public view — upgrade path for the LinkedIn Audit Tool above), and (b) automatic job-application tracking by detecting form submissions on job boards/ATS pages (the way Teal/Huntr do it). Real platform investment (Chrome Web Store review, ongoing maintenance) — evaluate after there's a meaningful user base to justify it, per the reasoning already in "Verifiable proof of outreach" below.
- **Voice interview practice** — candidate speaks answers aloud, gets real-time transcription + coaching, as a voice/mobile-first evolution of the existing text-based Interview Prep. Needs either a paid voice-interview partner (evaluate revenue-share terms — cap around 20% of session revenue) or a build with a transcription API (e.g. Whisper) + Claude for evaluation. Better as a v2 once a real Interview Prep experience is proven — see the Interview Prep entry above, which is itself not currently live.

## Engagement / Gamification (not built)

- **Pivot Tool** — for candidates open to adjacent roles or stuck 30+ days without market response: analyze existing profile/assessment data for transferable skills, suggest 5-8 adjacent roles with a fit rationale for each, and a pivot-specific narrative angle. Would live as its own dashboard page, triggered either by an explicit high "openness to adjacent roles" signal or a Victoria-initiated prompt after a stuck period.
- **Accountability partners** — opt-in peer pairing by function/level/week-in-search, with an anti-ghost mechanism (48-hour confirmation to activate the pairing, auto-dissolve after 2 missed check-ins, clean rematch). Distinct from the existing Support Network (which is the candidate's own personal contacts) — this would be candidate-to-candidate pairing within NextChapter.
- **Opt-in leaderboard** — anonymized, opt-in ranking by function or cohort. Would need enough active candidates in a given function/cohort to be meaningful rather than exposing individuals.

## Growth & Experimentation (not built)

- **A/B testing infrastructure** for landing-page copy and onboarding flow, via PostHog feature flags (PostHog is already installed and instrumented — `src/lib/posthog/` — this would be a genuinely new capability on top of it, not a new tool). Today, copy changes ship as direct edits with no variant testing or statistical-significance tracking.

## Deferred — liability-sensitive (not built, do not build without review)

These involve real legal/compliance exposure (financial advice, legal-document interpretation, data-accuracy claims) and shouldn't be built without deciding the liability perimeter first — flagged here so they aren't silently proposed inside an unrelated batch.

- **Offer Analysis Tool** — total-comp calculator, clause-flag list for things like non-competes/IP assignment/at-will provisions, negotiation prep, question generator. The liability risk is guiding someone's read of a legal document, even with disclaimers ("not a lawyer or financial advisor, use this to prepare better questions, not to make the decision").
- **Company Financial Health Brief** — a pre-offer research brief on a target employer's financial position (funding, burn signals, layoff history). Needs reliable data sources and clear accuracy disclaimers so stale or speculative data never gets surfaced as fact.
- **Employer Culture Ranking** — ranking specific real companies (not just abstract criteria, see Culture Match Tool above) against a candidate's Work Style profile. Needs an employer data layer that doesn't exist yet, and the accuracy/liability bar is similar to the Financial Health Brief.
- **Real-time salary intelligence** — peer-sourced compensation data by function/level/geography. Note `src/lib/market/` already pulls aggregate market data from Adzuna + BLS for the Hireability Report's market-conditions context; this would be a different, peer-sourced-and-current data source specifically for salary benchmarking, not an extension of the existing module.
