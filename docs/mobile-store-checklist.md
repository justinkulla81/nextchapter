# Store readiness checklist: NextChapter mobile app

Nothing here has been submitted, and no store account exists. App ids: iOS bundle id and Android package are both `com.launchyournextchapter.app` (change in `apps/mobile/app.json` before the first upload; they cannot change after).

## Costs (check the linked pages; prices change)

| Item | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | $99 per year | https://developer.apple.com/programs/ . An organization account needs a D-U-N-S number (free, takes days to weeks) and a legal entity. |
| Google Play Console | $25 one time | https://play.google.com/console/signup . An organization account also needs a D-U-N-S number. A new personal account must run a closed test with 12 testers for 14 days before it can publish to production; organization accounts do not. |
| Expo EAS builds | Free tier has a monthly build allowance (low priority queue); paid plans from $19 per month | https://expo.dev/pricing . Needed only to make store builds and the iOS Simulator build without Xcode. |
| Expo push notifications | Free | Used for new-match and layoff pushes. |
| Xcode | Free | Full Xcode from the Mac App Store is needed for a local iOS Simulator and `expo run:ios`. This Mac has only Command Line Tools. |

First-year total to be in both stores: about $124, plus any EAS plan.

## Needed before the first build

1. Decide the account owner (personal vs the company) and get the D-U-N-S number if it is the company.
2. Create the Expo project: `cd apps/mobile && npx eas-cli init` (links `extra.eas.projectId`, which push tokens need).
3. Set the public values as EAS environment variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POSTHOG_KEY` (the same values the website ships in `NEXT_PUBLIC_*`).
4. Replace the placeholder icon and splash in `apps/mobile/assets` (still the Expo defaults). iOS needs a 1024x1024 icon with no transparency; Android needs adaptive icon layers.
5. Apply `prisma/manual/2026-10-30-mobile-app.sql` in Supabase; set `MOBILE_PUSH_ENABLED=1` in Vercel when ready for pushes to go out.
6. Push notifications: iOS needs an APNs key (EAS makes it when you upload credentials while building); Android needs a Firebase project and `google-services.json` (FCM v1 credentials uploaded to Expo).
7. Builds: `npx eas-cli build -p ios --profile simulator` (Simulator build, no Apple account needed), `-p ios|android --profile production` for store builds.

## Apple App Store

- Listing: name (30 characters), subtitle (30), description, keywords (100), promotional text, support URL (https://launchyournextchapter.com/contact), marketing URL, privacy policy URL (https://launchyournextchapter.com/privacy-policy), category (Business or Lifestyle; job search apps usually pick Business), age rating questionnaire (expected 4+), copyright.
- Screenshots: 6.9-inch iPhone (1320x2868) required, 6.5-inch recommended; 3 to 10 each. iPad screenshots are not needed (`supportsTablet` is false).
- App Privacy labels (nutrition label), based on what the app does today:
  - Contact info: email address, linked to the user, for app functionality (only when signed in).
  - Identifiers: push token and user id, linked, for app functionality.
  - Usage data: product interaction (PostHog events), not linked to identity when signed out, for analytics.
  - User content / search history: saved job searches and employers, linked, for app functionality.
  - Tracking: none. No advertising id, no third-party ads, so no App Tracking Transparency prompt.
- Export compliance: `ITSAppUsesNonExemptEncryption` is false (HTTPS only).
- App Review information: a demo account (an existing test candidate login) with a note that sign-in is only needed to save. Notes that jobs open the employer's own career site and that layoff data comes from public WARN notices.
- Review risks to settle:
  - Guideline 5.1.1(v): an app with accounts must let people delete the account from inside the app. There is no delete-account flow on the site today (searched `src/app`). Needs a "Delete my account" action in the app and on the web, or a link to a web page that does it.
  - Guideline 4.2 (minimum functionality): the app is native and does real work, but keep the AI check and layoff lookup prominent so it does not read as a website wrapper.
  - Guideline 5.1.2: if the Google sign-in is ever added, Sign in with Apple must be added too. Today it is email and password only.
  - The job feed must not include listings that are removed or misleading; the board already drops stale and confidential jobs.
- Also needed: TestFlight internal test first, then submit.

## Google Play

- Listing: app name (30), short description (80), full description (4000), icon 512x512, feature graphic 1024x500, phone screenshots (2 to 8), category (Business), contact email (support@launchyournextchapter.com), privacy policy URL.
- Data safety form: same facts as the Apple labels. Data is encrypted in transit; users can request deletion (the account deletion gap above applies here too: Play requires a web link for deletion requests).
- Content rating questionnaire (IARC): no user-generated content, no violence; expected "Everyone".
- Target audience: 18 and over.
- Ads declaration: no ads. News-app and government-app declarations: not applicable.
- Target API level: Expo SDK 58 builds meet the current requirement; re-check at submission.
- App signing: let Play manage the signing key (EAS uploads an upload key).
- Testing track: internal testing first; closed test with 12 testers for 14 days if the account is personal.

## What the first release leaves out on purpose

Sign in with Google or Apple, in-app sign-up, in-app account deletion, tablet layouts, offline mode, deep links from emails. Each is a follow-up, and account deletion blocks the store submission.
