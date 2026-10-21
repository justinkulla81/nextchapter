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
