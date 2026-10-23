# Onboarding flow (final)

The owner has decided this order. Do not design against another order or re-add the old steps. Built behind `ONBOARDING_BUNDLES=on` (branch `claude/onboarding-google-account-step`).

1. Questions, with "Where you are" (journey) first.
2. Résumé. Required for unemployed journeys (laid off, returning to work, new grad) and for Market Reality lead-gen arrivals (`?goal=market-reality`). Optional ("Skip for now") for everyone else; skippers are prompted on Home to "Upload your résumé to get your Market Reality".
3. Aiming, level and function (asked directly if there is no résumé).
4. Where.
5. Coach.
6. One required "Continue with Google". It creates the account and connects Gmail and Calendar (personal Gmail only). No password and no separate sign-up screen. Answers given before sign-up carry over.
7. Payoff: what the scan found, what you gained, and the starting grade only if there is a résumé.
8. Welcome.

People with no personal Gmail leave their email on a waitlist. Limited to testers until Google approves the app. Setup: `docs/SETUP.md`.
