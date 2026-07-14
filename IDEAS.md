# Future Ideas

Backlog of ideas that came up in passing but aren't scheduled yet. Not a spec — just a place to not lose the thread.

## Branding

- Swap the site logo (header/nav, footer, dashboard, onboarding, org pages — everywhere the shared `Logo` component renders) to the new wordmark + upward-arrow mark image, replacing the current plain-text "NextChapter" span. Also restyle the favicon (`icon.tsx`), apple touch icon (`apple-icon.tsx`), and OG image (`opengraph-image.tsx`) to match, since those are currently separate text/SVG generators, not derived from the shared `Logo` component. Blocked on: getting the logo file saved into the repo (e.g. `public/logo.png`).

## Onboarding

- Build the real gated "retake your assessment" mechanism. Step 1 of onboarding now tells candidates they can retake their baseline assessment after 7 days of working their action plan, but that's copy-only for now — no actual mechanism exists yet. Needs: new fields to track eligibility (e.g. an `actionPlanStartedAt` or per-day-completed marker plus a 7-day elapsed check off `assessmentCompletedAt`), a real "Retake assessment" entry point on the dashboard once eligible, and a decision on what "retaking" actually resets (new `CandidateAssessmentResponse` row vs. overwriting fields vs. keeping history and blending).

## Dashboard

- Build a dedicated "My Stats" page for the reference/job-fit/work-sample/community-post counts that used to sit on the main dashboard as 4 stat tiles — removed from the homepage to keep it focused on today's actions and this week's grade, but the raw counts are still useful and shouldn't just disappear.
- Gate access to the Executive Coach (Victoria) chat behind the unlock-tier system, the same way The Circle is gated — right now it stays fully unlocked/visible on the dashboard for everyone since the gating logic doesn't exist yet. `TIER_UNLOCKS[1]` in `src/lib/community/unlock-tier.ts` already lists "coach chat" as a Tier 1 unlock, so this would mean either changing that copy to reflect a real higher-tier gate, or explicitly deciding coach access should stay free at Tier 1 and this idea is moot.
