# Page capture: email and journey on every SEO page

Built 2026-11-02. Code: `src/lib/capture/page-capture.ts`, `src/components/capture/`, `src/lib/leads/owner-inquiry.ts`.

Every state, county, city, industry, job-title (jobs and salary), company (employer) and college page carries the same block, switched on by one `capture` prop on its frame (`SeoPage` or `TopicShell`).

| Part | Who | What it does |
|---|---|---|
| Journey question | a person | The homepage picker (`JourneyPicker`, short form) ends in an email for the first-week plan. Stored as a `HomepageLead` of kind `journey`, `source` `page:<kind>:<slug>`, so the nurture and lifecycle emails pick it up |
| Follow by email | a person | `SaveSearchForm`: the page's search (title, place, industry) saved with the email, `source` `page:<kind>`. Employer pages keep their own box (`EmployerFollowBox`), so they pass no `save` |
| Owner inquiry | an organization | One work-email field. Files a `ContactSubmission` (audience ORGANIZATION, `source` `page:<kind>:<slug>`), the CRM person and the admin email, exactly as `/contact` does. Plus a link to the audience's full page |

Allowlists that must list a new kind: the journey `source` and alert `source` patterns in `src/lib/leads/actions.ts`, the pattern in `owner-inquiry.ts`, and `src/test/page-capture.test.ts`.

Events: `journey_picker_*` (with `source`), `job_alert_signup_submitted`, `owner_inquiry_submitted`, `owner_inquiry_submitted_client`, `owner_inquiry_page_link_clicked`.

Not covered: pages on their own frames (`/layoffs/company/<slug>`, `/layoffs/<state>`, workforce board, job center and economic development pages, `/network/company`). Layoff company pages already have their own journey form.

## Résumé gap check and header pictures (industry and job-title pages)

- `components/capture/FitCheck.tsx`: paste a résumé, see which of the page's most-named skills it says (`lib/capture/fit-check.ts`, deterministic, runs in the browser, nothing is sent), plus AI skills worth having. Beside it, "Make it yours": state, email and an optional résumé file, filed by `lib/leads/fit-lead.ts` as a `ResumeSubmissionLead` (target role `<page> · <state>`, source `page:industry|title:<slug>`). No AI and no parsing, so no per-use cost beyond storage and the one confirmation email when a file came with it. Events: `fit_check_run`, `fit_lead_submitted_client`, `fit_lead_submitted`, `fit_market_reality_clicked`.
- Job-title pages (`lib/seo/title-insights.ts`) add a market block (open jobs, median pay, BLS outlook and AI exposure when the title maps to an occupation, function-level skills and AI share from the stored topic snapshot) and career pivots from the pivot map. Layoff counts are by industry only; a title has no layoff count.
- Header pictures live in `public/images/topics`, made once by `scripts/topic-images/generate.ts` (about 4 cents each, 48 images). `src/test/topic-images.test.ts` fails when an industry or function has no picture.
- `components/topics/blocks.tsx` gives each section its own tint and the cards a colored top edge, so every page on `TopicShell` is less monochrome.

## Title outlook figures and place pictures

- `lib/seo/title-soc.ts` is a hand-written allowlist from job title (level words removed) to one 6-digit SOC occupation. A title gets an outlook, BLS median pay, openings and AI-use figure only where it is listed; the page names the BLS category it used. The general matcher in `lib/careers/title-match.ts` is not used for public figures (it returns near misses such as "account executive" -> advertising managers). To add a title, add it under its SOC in `BY_SOC`; `src/test/title-soc.test.ts` checks every code exists in the BLS table and no title sits under two occupations.
- `lib/market/occupation-projections.json` holds the BLS Employment Projections for all occupations. Rebuild yearly with `scripts/pivots/import-occupation-projections.ts <occupation.xlsx>` (download from https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx with a descriptive User-Agent first).
- Place pages use `SeoPage look="scene"` with a header picture from `lib/places/place-image.ts`: six regional scenes for states, three settings x three variants for counties and cities. The scene look (tinted section panels, colored stat edges) is in `globals.css`.

## Near-you strip (industry and job-title pages)

`YourState` (components/capture) shows the visitor's state with a link to that state's page and, on job-title pages, this title's open-job count there. The state is the one they chose before (localStorage `nc_state`), else a single request to `/api/visitor-state`, which reads the platform's IP geolocation header and stores nothing. The page renders the same for everyone until a state is known, and the résumé form's state field starts from it. Event: `your_state_clicked`.
