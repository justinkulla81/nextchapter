# NextChapter Apply Helper (Chrome extension)

Fills name, contact details, current job (from work history) and résumé on Greenhouse, Ashby and
Lever application pages, from the member's NextChapter profile. Never submits. Writes no answers.
Logs the application to My jobs once the employer's confirmation screen appears.

- Field mapping and site detection: `field-map.js` (tested in `src/test/apply-helper-field-map.test.ts`)
- Server: `src/app/api/apply-helper/{profile,resume,log,event}`; connect code in `src/lib/apply-helper/token.ts` (stateless, 30 days)
- Install page: `/dashboard/apply-helper`. The zip it serves is built by `scripts/build-apply-helper-zip.sh`: rerun and commit after any change here (a test fails if the zip is stale).
- AI hook (not built, would add per-use cost): essay and screening questions are skipped in `classifyField` (`skip` rule). Answers would plug in there.
- Chrome Web Store: once the account exists, zip this folder, upload, then change the install steps on the page.
