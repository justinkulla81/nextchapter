# NextChapter mobile app (iOS and Android)

First version, built with Expo and Expo Router in `apps/mobile`. It is a separate package: the Next.js build, `tsconfig.json` and ESLint skip `apps/**`.

## What it does (no login needed)

| Tab | What it does | Data |
| --- | --- | --- |
| Jobs | Search live professional jobs by title or company, place, remote, minimum pay. Tapping a job opens the employer's own career site (the `url` on each job) in the in-app browser. | `GET https://launchyournextchapter.com/api/mobile/jobs` |
| AI check | Type a job title, pick the occupation, see the exposure card, share it. | `GET /api/mobile/ai-check?q=` and `?soc=` |
| Layoffs | "Is my employer filing layoffs?" lookup plus a feed of recent WARN filings. Tapping a filing opens its company page. | `GET /api/layoffs/employer-lookup`, `GET /api/mobile/layoffs` |
| Saved | Sign in with the existing Supabase account, see and remove saved searches, turn on notifications. | `GET/POST/DELETE /api/mobile/saved` |

Sign-in is asked for only when someone taps Save search or "Alert me about new filings". Sign-in is email and password for existing accounts; "Create a free account" opens https://launchyournextchapter.com/auth/signup in the in-app browser.

## API routes added (all under `src/app/api/mobile/`)

- `jobs`: same board and filters as https://launchyournextchapter.com/jobs plus `minPay` and `offset` paging. Cached 5 minutes per query (`searchPublicBoardCached`), 300 requests per hour per address.
- `ai-check`: uses the O*NET title matcher and stored exposure data. No model call, so nothing is metered.
- `layoffs`: `queryLayoffs` (the same function behind https://launchyournextchapter.com/api/public/layoffs), cached 15 minutes.
- `devices` (POST): stores an Expo push token, tied to the user when a bearer token is sent.
- `saved` (GET, POST, DELETE): needs a Supabase bearer token, checked with Supabase on every call. 25 saved items per user.
- `src/app/api/cron/mobile-push`: hourly (`17 * * * *`). Sends new-match and new-layoff pushes through Expo's push service (free). **It does nothing until `MOBILE_PUSH_ENABLED=1` is set in Vercel**, so merging sends no notification.

Read routes send `Access-Control-Allow-Origin: *` (public data, like the existing public layoffs API). I also added the same header to `/api/layoffs/employer-lookup`.

Database: `MobileDevice` and `MobileSavedSearch` (see `prisma/manual/2026-10-30-mobile-app.sql`). Apply that SQL in Supabase before the saved-search and push features are used; the search, AI check and layoff screens do not need it.

## PostHog events

App side (sent straight to PostHog's capture endpoint, `source: mobile_app`): `job_search_run`, `job_apply_opened`, `ai_check_searched`, `ai_check_viewed`, `ai_job_check_shared`, `layoff_employer_lookup`, `layoff_notice_opened`, `mobile_sign_in`, `push_permission_answered`, `saved_item_removed`.
Server side: `mobile_device_registered`, `mobile_search_saved`, `mobile_search_removed`, `mobile_push_sent`.

## Run it

```bash
cd apps/mobile
cp .env.example .env     # fill in the Supabase and PostHog public values
npm install
npx expo start           # press i for the iOS Simulator (needs full Xcode), a for Android, w for web
```

To test against local API routes, run the Next dev server and set `EXPO_PUBLIC_API_URL=http://localhost:3100` in `apps/mobile/.env`.

Typecheck: `cd apps/mobile && npx tsc --noEmit`. API tests: `npx vitest run src/test/mobile-api.test.ts`.

## Screenshots

`docs/mobile/screenshots/`: Jobs with filters, AI check result and share, layoff lookup and feed, Saved (signed out). These were taken from the Expo web build at phone size, because this Mac has only the Command Line Tools and no Xcode, so there is no iOS Simulator. See the store checklist for the native-build step.

## Structure

`src/app` holds routes only; `src/screens` the screen bodies; `src/lib` the API client, auth, push and tracking; `src/components` shared UI.
