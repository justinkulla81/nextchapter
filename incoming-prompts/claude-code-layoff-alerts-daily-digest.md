# Layoff alerts + CHRO drafts, merged into the daily digest

## Why
HubSpot (660 jobs) was caught by our own system, but Justin never heard about it:
- The news was out Oct 5 19:02 UTC (FourWeekMBA) and Oct 6 05:11 UTC (Boston Globe), then CBS and Boston.com.
- `runLayoffNewsCheck` (inside `/api/cron/warn-sync`, once a day at 07:00 UTC) logged all four mentions at 2026-10-07 07:00 UTC and created a MANUAL_ANNOUNCEMENT WarnNotice (never promoted).
- The MA WARN filing was promoted to a CRM lead at 2026-10-07 15:03 UTC.
- Nothing emailed Justin. The only daily admin email is the homepage visitor digest (`/api/cron/homepage-visitor-digest`, 04:00 UTC), and it says nothing about layoffs.

Goal: detect within ~2 hours, put every new layoff in one daily digest, alert right away on big ones, and hand Justin the CHRO's name and a ready-to-send email draft. Justin always sends manually.

## Do this

### 1. Check more often
- Split the news check into its own route, `/api/cron/layoff-news-check`, scheduled `0 */2 * * *` in vercel.json. Keep warn-sync daily, but have it skip the news check now.
- Add query variants: "workforce reduction", "restructuring jobs", "eliminate positions", "layoffs percent of workforce", "cuts staff".
- Keep the two-publisher rule for creating a notice. Single-publisher mentions go in a "Watching" list in the digest.
- New source: SEC 8-K Item 2.05 (exit or disposal costs). Use EDGAR full-text search (`https://efts.sec.gov/LATEST/search-index?q="Item 2.05"&forms=8-K` plus a date range of the last 3 days) with a User-Agent containing a contact email, as SEC requires. Each new filing becomes a WarnNotice. Add the enum value `SEC_8K` with a migration, or use MANUAL_ANNOUNCEMENT with layoffType "SEC 8-K Item 2.05", whichever fits the code better. Dedupe against existing notices with the existing `sameEmployer` and COVERED_DAYS logic.
- Auto-promote MANUAL_ANNOUNCEMENT and SEC notices to CRM leads, the same way WARN filings are promoted.

### 2. Find the HR leader (public professional info only)
- New `src/lib/warn/hr-contact.ts`: for each new notice with 100+ employees (or unknown headcount at a company we know is large), call Claude via `getAnthropicClient()` with the server-side web search tool. Find the current CHRO / Chief People Officer / top HR leader: name, title, source URL, confidence (high/medium/low).
- Store the results in a new table (`LayoffContact`: noticeId, companyId, name, title, sourceUrl, confidence, emailGuess, emailVerified=false, foundAt). Cache per company for 90 days. Cap it at 15 lookups per run to control cost.
- Email address: if the CRM already has a contact at that org with an HR-type title, use it (verified). Otherwise guess from the company's known email pattern and label it "unverified — check before sending". Never scrape gated sites. Never store data about the people being laid off.

### 3. Draft the email (never send it)
- For each contact, generate a short email (under 150 words) from Justin Kulla, founder of NextChapter, justin@launchyournextchapter.com. Be transparent: founder, not a pretext. Acknowledge the news in one line, without commenting on the decision. Offer NextChapter free to their affected employees. Make one specific ask: a 15-minute call, or a link they can share with affected staff. Make the tone warm and senior-to-senior, with no hype.
- Store the subject and body with the contact. Build a Gmail compose link: `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...`.

### 4. One daily digest (replaces the homepage visitor digest)
- Rename the email to "NextChapter daily digest". Move it to `30 11 * * *` (7:30am ET), after the overnight news runs. Keep the visitor logic as it is.
- Subject: `Daily digest: <N> new layoffs (<biggest company> <headcount>) · <V> visitors`.
- Sections, in this order:
  1. **New layoffs since the last digest**: WarnNotices fetched since the last send, not dismissed, merged by employer across sources, sorted by headcount. Each card shows: company, headcount and % if known, state/HQ, source type (news / SEC / WARN) with links, first-seen time, HR leader + title + confidence + source, email (verified/unverified), the draft's first line, an "Open draft in Gmail" button and a CRM lead link.
  2. **Watching**: single-publisher mentions not yet confirmed.
  3. **Homepage visitors**: the existing content.
- Record each send (a DigestSend row or similar) so "since the last digest" is exact, not a fixed 24 hours.
- Send it whenever any section has content.

### 5. Immediate alert for big ones
- When any path creates a notice with 250+ employees, or one for a company already in the CRM, send a separate email right away: `Layoff alert: <Company> cutting <N>`, with the same card (contact lookup and draft included). Add `alertSentAt` to WarnNotice so it never alerts twice. Still include it in the next digest.

### 6. Test before shipping
- Add `?dryRun=1` to the digest route. It renders the last 3 days and sends only to the admin email, with no state changes.
- Run the dry run locally and confirm HubSpot appears, with an HR leader found and a draft.
- Add unit tests for the merge/dedupe across news, SEC and WARN, and for the alert threshold.
- Run typecheck and tests. Show Justin screenshots of the rendered digest and alert, then wait for "deploy".
- Emails go only to the admin address. Never email anyone else.
