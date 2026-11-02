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
