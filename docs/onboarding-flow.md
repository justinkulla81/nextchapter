# Onboarding flow (final)

The owner has decided this order. Do not design against another order or re-add the old steps. Built behind `ONBOARDING_BUNDLES=on` (branch `claude/onboarding-google-account-step`).

1. Questions, with "Where you are" (journey) first.
2. Résumé. Required for unemployed journeys (laid off, returning to work, new grad) and for Market Reality lead-gen arrivals (`?goal=market-reality`). Optional ("Skip for now") for everyone else; skippers are prompted on Home to "Upload your résumé to get your Market Reality".
3. Aiming, level and function (asked directly if there is no résumé).
4. Where.
5. Coach.
6. The account step, one required screen that creates the account. **While Google connect is off (until CASA, set by `GOOGLE_CONNECT_ENABLED`, default off; `src/lib/google/connect-switch.ts`) it is an email and a password**, confirmed by a link (`/onboarding/create-account`); the Google reveal after sign-up is skipped. **When Google connect is on** it is one "Continue with Google" that creates the account and connects Gmail and Calendar (`/onboarding/connect`), followed by the optional Google reveal for members who registered under the earlier order. Nothing in the candidate area waits on a Google connection while it is off (Victoria's weekly advice, the Weekly Sprint rows, the connect-accounts note, the Network and activation locks).
7. Payoff: what the scan found, what you gained, and the starting grade only if there is a résumé.
8. Welcome.

While Google connect is on, people with no personal Gmail leave their email on a waitlist, and connecting is limited to testers until Google approves the app. Setup: `docs/SETUP.md`.
