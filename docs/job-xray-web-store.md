# Job X-ray: Chrome Web Store checklist

Nothing has been submitted. This lists what the listing needs. The package is `public/downloads/nextchapter-job-xray.zip` (built by `scripts/build-job-xray-zip.sh`).

## Listing text
- **Name:** NextChapter Job X-ray
- **Summary (132 characters max):** See AI use, recent layoffs and pay versus the median on LinkedIn, Indeed and Google Jobs postings.
- **Description:** On a job posting, a small panel shows (1) how much of the job's tasks AI is already used for, from the Anthropic Economic Index, (2) whether the employer has filed WARN layoff notices or announced cuts in the last 12 months, (3) where the posted pay sits against the median for that job title, when the posting shows pay, and (4) links to the full NextChapter pages and to the same role on the employer's own career site when we have it. It only reads the page you are already viewing. It does not fill forms, apply, message anyone or change anything on your accounts.
- **Category:** Productivity (alternative: Tools)
- **Language:** English
- **Support/homepage URL:** https://launchyournextchapter.com/tools/ai-job-check
- **Single purpose statement:** Show facts about the job posting you are viewing (AI use, employer layoff filings, pay versus median).

## Assets to produce
- Icon 128x128 (in the zip: `icons/icon128.png`; confirm it is the final brand mark).
- 1 to 5 screenshots, 1280x800: the panel on a LinkedIn posting, an Indeed posting, a Google Jobs posting, a posting with a layoff notice, the collapsed panel.
- Small promo tile 440x280 (required); marquee 1400x560 (optional).

## Privacy practices tab
- **Data collected:** website content (the job title and employer name on the page) is sent to NextChapter to look up the facts. Usage pings send a random install id, the site name (linkedin/indeed/google), and which link was clicked.
- **Not collected:** personal information, account data, browsing history, page text, posted pay, cookies.
- **Certifications to tick:** data not sold; not used for unrelated purposes; not used for creditworthiness or lending.
- **Privacy policy URL:** https://launchyournextchapter.com/privacy (confirm it mentions the extension's two data points before submitting).
- **Remote code:** none. All code is in the package.

## Permission justifications
- **`storage`:** keeps one random install id (no personal data) so usage counts are not double counted.
- **Host `https://launchyournextchapter.com/*`:** the only server the extension talks to (`/api/xray/lookup`, `/api/xray/event`).
- **Content script matches `linkedin.com/jobs/*`, `*.indeed.com/*`, `google.com/search*`:** to read the job title, employer and pay shown on the posting and draw the panel. No other sites. The script acts only on Google results when the Jobs view is open.
- No `tabs`, `activeTab`, `scripting`, `cookies`, `history` or broad host permissions.

## Review notes for the reviewer
- Read-only; no auto-apply, no writes to any account.
- Network traffic: one GET with `title` and `employer`, one POST with install id, site and link name. Both are to launchyournextchapter.com and carry no cookies.
- Test steps: open any job on https://www.indeed.com or https://www.linkedin.com/jobs, wait about a second, the panel appears bottom right.

## Before submitting (owner)
- Developer account and one-time fee.
- Confirm the privacy policy wording and the support URL.
- Take final screenshots.
