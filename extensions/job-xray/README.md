# NextChapter Job X-ray (Chrome extension)

A small read-only panel on LinkedIn, Indeed and Google Jobs postings: AI use in the job (Anthropic Economic Index), WARN layoff notices and announced cuts for the employer in the last 12 months, where the posted pay sits against the median for the title, and links to the NextChapter page and the employer's own career-site posting when we hold it.

- Page selectors for all three sites: `sites.js` only, with a schema.org `JobPosting` JSON-LD fallback. Fixtures: `src/test/fixtures/xray/`, tests: `src/test/xray.test.ts`.
- Pay parsing and comparison: `pay.js`. The posted pay never leaves the browser; the median comes from the server.
- Network: `background.js` only. `GET /api/xray/lookup?title=&employer=` and `POST /api/xray/event` (code in `src/app/api/xray`, `src/lib/xray`). Public, no auth, no model calls, cached, rate limited by address.
- Build the zip with `scripts/build-job-xray-zip.sh` (writes `public/downloads/nextchapter-job-xray.zip`); rerun and commit after any change here.
- Web Store listing: `docs/job-xray-web-store.md`.
