# Claude Code prompt: report version 1.1 and email capture

How to run it:

1. Open Terminal.
2. Type `cd ~/nextchapter` and press Enter.
3. Type `claude` and press Enter.
4. Type: `Read incoming-report/claude-code-report-v1.1-and-email-capture.md and do it.` and press Enter.

---

You are updating the NextChapter Displacement Report on launchyournextchapter.com and adding email capture. Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first. Show me the diff, screenshots of each new UI state, and check results before deploying.

## 1. Publish version 1.1 of the September report

- **Replace the edition page.** The updated source is `incoming-report/displacement-report-september-2026.html`. Port it into the existing route `src/app/reports/displacement-report-september-2026` the same way version 1.0 was ported:
  - server-rendered text
  - scoped CSS
  - chart script loaded with `next/script`
- **New chapters to include.** These are new or changed in 1.1:
  - Older workers
  - Jobs being created and destroyed
  - New businesses, self-employment and AI
  - New graduates and blue-collar work (expanded)
  - The mid-career skills gap (inside Skills)
  - Contact line: Justin Kulla, Founder and CEO, jkulla@launchyournextchapter.com
  - Version log entry for 1.1
- **Replace the files** in `public/reports/` with the new copies from `incoming-report/`:
  - `displacement-report-2026-09.pdf`
  - `displacement-report-2026-09-data.csv`
  - `wc-index.csv`
- **Copy the updated scripts** `nc_cps_breakdowns.py` and `nc_build_pdf.js` into `scripts/displacement/`.
- **Update metadata.** Set `dateModified` (JSON-LD and `article:modified_time`) to 2026-10-06. Add new FAQ entries only if they appear in the page.
- **The cover wordmark should match the site's `Logo` component:** bold navy "NextChapter". Use the component itself.

## 2. Newsletter: one list, clear promise

- **Use the existing `NewsletterSignup` component and `subscribeToNewsletter` action.** Do not build a second list.
- **Make the copy fit where the box appears.** Add an optional `variant` prop so the box can say "The Displacement Report, monthly, plus the weekly job-market email" on report pages, while keeping today's copy elsewhere. Add `source` values as needed:
  - `displacement-report-popup`
  - `displacement-report-pdf`
  - `site-footer`
- **Check whether a sitewide signup exists.** If no newsletter box appears in the public site footer or on `/news`, `/resources` and `/reports`:
  - add a compact single-line footer version to `PublicSiteChrome` with source `site-footer`, shown on all public marketing pages
  - add the full box on `/news`, `/resources` and `/reports`
- **On the report page,** replace the `#newsletter-slot` placeholder in the "Get the next edition" section with the signup component.

## 3. Pop-up on report pages

Show a newsletter pop-up on `/reports` and on report edition pages only. It must be polite and accessible.

- **When it appears:** after the reader scrolls 50% of the page, or after 45 seconds, whichever comes first. Never on page load.
- **When it does not appear:**
  - more than once per 30 days per browser (remember a dismissal or signup in `localStorage`, wrapped in try/catch)
  - to visitors who already subscribed (set a cookie on successful signup and check it)
  - on mobile when it would cover the main content; use a bottom sheet there instead
- **Accessibility:**
  - focus moves into the dialog
  - Escape closes it
  - there is a visible "No thanks" button
  - the background is not scroll-locked longer than necessary
- **Search engines:** follow Google's intrusive-interstitial guidance. Nothing may block content for visitors arriving from search on first load.
- **Content:** one sentence on what they'll get, the email field, a "Get the report monthly" button, and "No thanks."

## 4. Email gate for the PDF download

- **Button behavior.** The "Download PDF" button opens a small dialog asking for an email address, which subscribes them with source `displacement-report-pdf`. On success:
  - show "Check your inbox — your PDF is on its way. You can also download it now."
  - offer a direct download link
  - email the PDF link using the existing email setup (Resend), if a transactional email path already exists; otherwise skip the email and rely on the direct link
- **Already subscribed** (cookie set): download immediately with no dialog.
- **Keep the full report readable** on the page without any gate. Search engines and AI tools index the HTML, and that is the main traffic source.
- **Press and researchers:** add a small "Media or researcher? Download directly" link under the button that downloads the PDF without the gate. Reporters avoid gated files, and citations matter more than one email address.
- **The CSV data downloads stay ungated.**
- **Track conversion:** add analytics events (PostHog, already installed) for:
  - `report_pdf_gate_shown`, `report_pdf_gate_submitted`, `report_pdf_downloaded`
  - `newsletter_popup_shown`, `newsletter_popup_submitted`, `newsletter_popup_dismissed`

## 5. Checks

1. Run `npm run build` and `npm run lint`.
2. Test each signup path end to end on a preview deploy with a test address, and confirm the `NewsletterSubscriber` row and its `source`.
3. Confirm the pop-up never shows twice in 30 days, never shows to subscribers, and the gate skips for subscribers.
4. Run Lighthouse on the report page and confirm SEO and Accessibility stay at or above their previous scores.
5. Show me screenshots and the diff, then deploy when I approve. After deploy, run the IndexNow script for the report URL.
