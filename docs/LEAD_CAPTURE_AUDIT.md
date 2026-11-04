# Lead capture audit: pain and payoff

Started 2026-11-04 at the owner's direction: every lead capture says the pain the reader has and the payoff they get, in plain words
(no "WARN", no product names in the headline). Button labels are the action: "Get my ...", "Start my ...", "Show me ...".

Copy lives in `src/lib/capture/pull-copy.ts` (the navy `NextStepBox` on every public page) and is picked by the page's first folder.

## Done in this pass

| Where | Before | After |
|---|---|---|
| `NextStepBox` default (every public page) | "See where you stand in the market today" | "Applying and hearing nothing back?" Button stays the tested assessment label |
| `NextStepBox` on `/layoffs/*`, `/unemployment-benefits/*`, `/start/*` | same as default | "Just got laid off? Do not spend week one guessing." / "Get my laid-off game plan" |
| `NextStepBox` on `/salaries/*` | default | "Not sure you are paid what you are worth?" / "Show me what I am worth" |
| `NextStepBox` on `/ai-skills`, `/ai-job-check` | default | "Worried a computer could take your job?" / "Start my AI-proof plan" |
| "Not ready?" link | "Get a first-week plan by email instead." | "Email me a first-week plan instead." |
| `JourneyPicker` step 4 box | assessment headline | same pain copy (laid-off version when that situation was picked) |
| Network join headline (role, function, industry pages) | "Are you a CRO? Join your peers." | "Job hunting as a CRO? Do not do it alone." |
| Nine seeker tool pages (`ActionBand`) | "Get my free assessment" everywhere | one pain headline and one action button per tool |
| `/layoffs/this-week` page | "new WARN notices", "workers named" | plain headline and intro, "people", one line that explains WARN |
| Weekly roundup (LinkedIn, email, press pitch) and the two automated social roundups | "state WARN filings ... naming N workers" | "N people found out this week that they are losing their jobs", a laid-off ask, hashtags (posts only) |

## Held for the owner

- **The nav button test** (`src/lib/ab/nav-cta.ts`, started 2026-11-03) rewrites any label containing "assessment". The default box keeps that label so the test
  stays clean. The pain buttons ("Get my laid-off game plan" and the others) are outside the test, so they are not measured against the four arms. Decide whether
  to add them as arms or end the test.
- Hashtags are on the roundup posts only. `src/lib/social/validate.ts` still rejects hashtags in model-written posts; change that rule if the owner wants them there too.

## Not yet rewritten (next pass, in order of traffic)

1. Home page (`NewHome.tsx`, `HomeTryIt.tsx`): two buttons that still say "Get your Market Reality Assessment".
2. Site header button and mega menu (`SiteNavMega.tsx`), the footer band (`PublicSiteChrome.tsx`: "Ready to start your next chapter?").
3. Save-search and follow boxes (`saveCopy` in `src/lib/capture/page-capture.ts`): "Follow by email" has no pain. Proposed: "Tired of checking job boards?" / "Email me new matches".
4. `FitCheck.tsx` (industry and title pages): résumé gap check. Proposed: "Does your résumé say what this job asks for?"
5. Layoff company pages (`LandingHero`, `Q1` answers in `src/lib/layoffs/landing.ts`): the answers are good; the button reads "Email me my first-week plan", which is fine.
6. `LaidOffStart`, `LayoffRiskCheck`, `PersonaOnboardingCta`, `OrgCandidateBand`, `AiExposureSection`, `FreeAiTool`: all say "Get your free Market Reality Assessment".
7. Emails (`journey-plan`, `layoff-alert-digest`, `deadline-reminder`, `intake-emails`) and the lifecycle content: subject lines and buttons.
8. Organization asks (`OwnerInquiry`, `/for-organizations`): pain for an employer ("Did a layoff leave you with people to place?") needs the owner's wording.
