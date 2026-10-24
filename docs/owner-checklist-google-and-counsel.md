# Owner checklist: Google console and counsel review

What the code needs from the Google Cloud console, and the wording counsel should read. Written from the code on `main`.

## Google Cloud console

Authorized redirect URIs the code sends to Google. Each must be listed on the OAuth client that is active in production, on every host the app is served from (`https://launchyournextchapter.com` and `https://candidate.launchyournextchapter.com`):

| Path | Used by |
|---|---|
| `/api/auth/gmail/callback` | Gmail connect on the candidate site (`src/lib/email-tracking/gmail-oauth.ts`; sent from the candidate host) |
| `/api/google/oauth/callback` | Combined Google connect (`src/lib/google/oauth.ts`; host is `NEXT_PUBLIC_APP_URL`) |
| `/api/admin/google-calendar/callback` | Admin calendar connect for webinars |
| `/auth/callback` | Sign in with Google (this is the app's own return URL; the provider's redirect for it is Supabase's `…/auth/v1/callback` on the project domain) |

A path missing from the console makes Google answer `redirect_uri_mismatch` and the connect button fails.

Scopes the code requests (the consent screen and the verification submission must list all of them):

- `https://www.googleapis.com/auth/gmail.readonly` (restricted)
- `https://www.googleapis.com/auth/gmail.send` (restricted)
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/documents.readonly`
- `openid`, `email`

Restricted scopes need Google's verification and, for production use by outside accounts, the security assessment. Status of that submission is only visible in the console, so someone with console access must confirm it.

## Counsel: "Attach my dossier"

Where: the apply form (`src/components/jobs/NativeApply.tsx`). Exact wording shown to the candidate:

- Buttons: "Don't attach my dossier" and "Attach my dossier".
- When attached: "A private link to your dossier goes with this application. It expires in 30 days and you can revoke it any time in Account and privacy."
- When not attached: "Your dossier stays with you unless you attach it. Attaching shows the poster the proof behind your résumé."
- Candidate+ members also see: "The poster will also see that you are a Candidate+ member."

Facts counsel should check the wording against: the link is a private link, it expires after 30 days, the candidate can revoke it from Account and privacy, and the poster sees Candidate+ membership with the application.

## 2026-10-24: Coach Google Calendar (separate OAuth client)

Each coach can connect their own Google Calendar so clients are only offered times the coach is free, and each session lands on the coach's own calendar with a Meet link. It uses its own OAuth client, not the candidate or admin one. **It is off until the two environment variables below are set**, so merging the code changes nothing: the connect button says it is not available and bookings keep using the shared NextChapter calendar.

What the code asks Google for (exactly these, nothing else): `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.freebusy`, `openid`, `email`. The free/busy scope returns only busy or free, never titles, guests or descriptions, so the "we read only busy or free" promise on the page is enforced by Google. The code refuses a grant if either calendar scope was unticked on the consent screen.

Redirect URI to register (one host only, the value of `NEXT_PUBLIC_APP_URL`):

| Path | Full URI |
|---|---|
| `/support/coach/google/callback` | `https://launchyournextchapter.com/support/coach/google/callback` |

Steps, in order:

1. Apply `prisma/manual/2026-10-24-coach-google.sql` to the production database (one new table, `CoachGoogleConnection`, and one new nullable column, `CoachBooking.googleCalendarId`). It is additive. Do this before the deploy that includes the code.
2. Google Cloud console, in the project that holds the other NextChapter OAuth clients (or a new project): **APIs & Services > Library > Google Calendar API > Enable**.
3. **APIs & Services > OAuth consent screen > Data access > Add or remove scopes.** Add `…/auth/calendar.events` and `…/auth/calendar.freebusy` (plus `openid` and `email` if not already listed). Both calendar scopes are "sensitive", not restricted: no security assessment, but Google's standard verification applies. Until verified, set publishing status to **In production** and expect the "unverified app" warning once per coach (fine for under 100 users); in **Testing** mode each coach must be listed as a test user and the grant expires after 7 days.
4. **APIs & Services > Credentials > Create credentials > OAuth client ID.** Application type **Web application**, name "NextChapter coach calendar". Under **Authorized redirect URIs** add `https://launchyournextchapter.com/support/coach/google/callback` (and `http://localhost:3000/support/coach/google/callback` if you want to test locally). No JavaScript origins needed.
5. Copy the client ID and client secret into the Vercel project's Production environment variables as `COACH_GOOGLE_CLIENT_ID` and `COACH_GOOGLE_CLIENT_SECRET`. Do not paste them into chat, a file or a commit.
6. Make sure `TOKEN_ENCRYPTION_KEY` is already set in the same environment: the coach's access and refresh tokens are stored encrypted with it.
7. Redeploy production. Then sign in as a coach, open **Calendar and booking** in the coach portal, and press **Connect Google Calendar**. A first-time connect shows Google's consent screen listing only the calendar permissions above.

Behaviour to know when it is on:

- A coach who never connects keeps the shared-calendar flow. A coach who connects is offered only free times, and sessions are written to the first calendar in their list.
- If Google stops accepting a coach's access (removed in their Google account, password change), the coach is marked disconnected, **new bookings pause** (clients see that the coach is not taking bookings right now), the coach sees a reconnect banner on every coach page, and sessions already booked keep their Meet links. Reconnecting resumes bookings.
- Because the free/busy scope cannot list a coach's calendars, a coach adds extra calendars to check by their address (for example `family@group.calendar.google.com`); the code confirms Google can see each one before it is added.
