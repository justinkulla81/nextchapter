# Future Ideas

Backlog of ideas that came up in passing but aren't scheduled yet. Not a spec — just a place to not lose the thread.

## Branding

- Swap the site logo (header/nav, footer, dashboard, onboarding, org pages — everywhere the shared `Logo` component renders) to the new wordmark + upward-arrow mark image, replacing the current plain-text "NextChapter" span. Also restyle the favicon (`icon.tsx`), apple touch icon (`apple-icon.tsx`), and OG image (`opengraph-image.tsx`) to match, since those are currently separate text/SVG generators, not derived from the shared `Logo` component. Blocked on: getting the logo file saved into the repo (e.g. `public/logo.png`).

## Onboarding

- Build the real gated "retake your assessment" mechanism. Step 1 of onboarding now tells candidates they can retake their baseline assessment after 7 days of working their action plan, but that's copy-only for now — no actual mechanism exists yet. Needs: new fields to track eligibility (e.g. an `actionPlanStartedAt` or per-day-completed marker plus a 7-day elapsed check off `assessmentCompletedAt`), a real "Retake assessment" entry point on the dashboard once eligible, and a decision on what "retaking" actually resets (new `CandidateAssessmentResponse` row vs. overwriting fields vs. keeping history and blending).
