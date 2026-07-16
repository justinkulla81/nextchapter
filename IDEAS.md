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

- Verifiable proof of outreach, beyond self-report. Today "I reached out" (help script, outreach logging) is entirely self-reported — there's no way to confirm a message was actually sent. A real version would need something like an email/LinkedIn integration to detect real sends, which is a meaningfully separate integration effort — deferred rather than folded into the Network page rework.

## Community

- Add a news-article feed to the merged Community page — curated job-market/career-news items interspersed with candidate posts and activity, to give the feed something to show even when candidate activity is quiet. Needs an actual content/curation pipeline (an editorial source or a news API), which doesn't exist yet — logged here rather than built as part of the Community+Circle merge.

## Interview Prep

- Bring back a candidate-facing "answer interview questions" feature (previously `/dashboard/interview`, the `InterviewResponse` model), but only once there's a real recruiter/coach on the other end of it — without an audience, candidates have no reason to volunteer written answers to a static question bank on their own. Re-introduce it as part of the recruiter/coach experience instead: let a recruiter or coach pick which questions they actually want answered (an "option bank" selection, not a fixed list), so the exercise has a concrete purpose and a real reader. Removed from nav/routing for now; the `InterviewResponse` and `InterviewQuestionBank` Prisma models were left in schema untouched so any historical responses aren't lost and the redesigned version doesn't have to start from scratch.

## Dashboard

- Build a dedicated "My Stats" page for the reference/job-fit/work-sample/community-post counts that used to sit on the main dashboard as 4 stat tiles — removed from the homepage to keep it focused on today's actions and this week's grade, but the raw counts are still useful and shouldn't just disappear.
- Gate access to the Executive Coach (Victoria) chat behind the unlock-tier system, the same way The Circle is gated — right now it stays fully unlocked/visible on the dashboard for everyone since the gating logic doesn't exist yet. `TIER_UNLOCKS[1]` in `src/lib/community/unlock-tier.ts` already lists "coach chat" as a Tier 1 unlock, so this would mean either changing that copy to reflect a real higher-tier gate, or explicitly deciding coach access should stay free at Tier 1 and this idea is moot.
