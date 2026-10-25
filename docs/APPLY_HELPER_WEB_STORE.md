# Apply Helper: Chrome Web Store submission kit

Ready to paste once the Chrome Web Store developer account exists (one-time $5 fee, owner's account).
The package to upload is `public/downloads/nextchapter-apply-helper.zip`, but the store wants the
extension files at the zip's top level, not inside a folder: run `cd extensions/apply-helper && zip -r ../../apply-helper-store.zip . -x '*.DS_Store' -x README.md`.

## Listing
- **Name:** NextChapter Apply Helper
- **Summary (132 chars max):** Fills your name, contact details, current job and résumé on Greenhouse, Ashby and Lever applications. You review and submit.
- **Category:** Productivity
- **Description:** Applying to jobs means typing the same details again and again. Apply Helper fills them in from your NextChapter profile on Greenhouse, Ashby and Lever application pages when you click "Fill from my profile". It fills your name, email, phone, current company and title, and attaches your latest résumé. It never presses Submit, never writes answers for you, and leaves essay, salary, work authorization and diversity questions blank. When an employer confirms your application, it adds the job to My jobs in NextChapter. Requires a free NextChapter account.

## Single purpose
Fill job application forms on Greenhouse, Ashby and Lever from the user's NextChapter profile, and record submitted applications in the user's NextChapter My jobs list.

## Permission justifications
- **storage:** keeps the user's connect code, an on/off switch, and a short-lived note that the user clicked Submit (so the confirmation screen can be logged).
- **Host access, launchyournextchapter.com:** reads the user's profile and résumé and records applications, using the user's connect code.
- **Host access, greenhouse.io / jobs.ashbyhq.com / jobs.lever.co:** the only sites the helper runs on, to read form field labels and fill them.
- No remote code, no analytics from the extension itself, no data sold or shared.

## Privacy disclosures (dashboard answers)
- Data handled: personally identifiable information (name, email, phone), work history (current employer and title), résumé file. Used only to fill the user's own applications. Not sold, not used for unrelated purposes, not used for creditworthiness.
- Usage events (page seen, form filled with a field count, connected/disconnected) go to NextChapter, never field values.
- Privacy policy URL: https://launchyournextchapter.com/privacy-policy
- Support: support@launchyournextchapter.com

## Assets still needed (not in repo)
- 128x128 icon (add to manifest `icons`), at least one 1280x800 screenshot of the fill box on an application page, 440x280 promo tile (optional).
- Review will check the site list in `host_permissions` against the description; keep them in step.

## After approval
1. Change the install steps on `/dashboard/apply-helper` (`src/components/dashboard/ApplyHelperPage.tsx`) to a single "Add to Chrome" button linking to the store listing; keep the manual download under "Show more" for people on managed browsers.
2. Updates then ship through the store; bump `version` in `manifest.json` each time.
