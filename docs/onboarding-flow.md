# Onboarding flow (final)

The owner has decided this order. Do not design against another order or re-add the old steps. Built behind `ONBOARDING_BUNDLES=on` (branch `claude/onboarding-google-account-step`).

1. Questions, with "Where you are" (journey) first.
   **Save for later (owner approved 2026-11-05):** under the first question, a quiet text-weight form, "Not ready now? Email me a link to finish later" (`SaveForLater`, `src/app/onboarding/save-for-later-actions.ts`). It is not a second primary action: Continue stays the only one. It stores the email on the profile (the details step pre-fills it), files the visitor as a lead, and the "pick up where you left off" email goes within about 30 minutes. It does not change the order of the steps.
2. Résumé. Never required (owner decision, 2026-10-29): anyone may skip it, Market Reality arrivals and unemployed journeys included, but the upload is the main action and skipping is a small link under it. Skippers go to the details step (`/onboarding/details`: first name, last name, email, LinkedIn optional) and are prompted on Home to "Upload your résumé to get your Market Reality". The same details step runs when a résumé is read but held no name or email. No account can be created without a name and an email (`needsContactDetails`, `src/lib/onboarding/details.ts`), and a registered member with no name on file is asked once on the dashboard.
   The upload returns as soon as the file is stored (`startResumeUpload`); reading it, the profile fill and the analysis run afterwards (`src/lib/resume/background-parse.ts`) while the page shows progress. State lives in `journeyDetails.resumeParse`; a Resume row counts as a résumé only once reading has finished. Failure shows "Try again" / "Upload a different file".
3. Aiming, level and function (asked directly if there is no résumé).
4. Where.
5. Coach.
6. The account step, one required screen that creates the account. **While Google connect is off (until CASA, set by `GOOGLE_CONNECT_ENABLED`, default off; `src/lib/google/connect-switch.ts`) it is an email and a password**, confirmed by a link (`/onboarding/create-account`); the Google reveal after sign-up is skipped. **When Google connect is on** it is one "Continue with Google" that creates the account and connects Gmail and Calendar (`/onboarding/connect`), followed by the optional Google reveal for members who registered under the earlier order. Nothing in the candidate area waits on a Google connection while it is off (Victoria's weekly advice, the Weekly Sprint rows, the connect-accounts note, the Network and activation locks).
7. Payoff: what the scan found, what you gained, and the starting grade only if there is a résumé.
8. Welcome.

While Google connect is on, people with no personal Gmail leave their email on a waitlist, and connecting is limited to testers until Google approves the app. Setup: `docs/SETUP.md`.

## Pick-up emails (people who started and left an email)

`src/lib/onboarding/abandoned-start.ts` (rules, pure) and `abandoned-run.ts` (the pass), run by the `lead-lifecycle` cron every few minutes. Two emails: two hours after the last activity (at once after "Email me the link"), then three days after the first; a step past its window is skipped; two days between any two emails from us. Skips anyone registered, unsubscribed, suppressed, opted out, or who finished the old assessment (the `registration-reminders` cron covers them). The button is a magic link to their place. **Off until `ABANDONED_START_EMAILS=1`**; off, the cron response shows `abandonedStarts` counts only. PostHog: `onboarding_pickup_email_sent`, `nudge_email_clicked` (all nudge emails, by `kind` and `step`), `onboarding_save_for_later`, `onboarding_step_viewed` (every step, with source), `onboarding_bundle_completed` (answered).

## The email box on every call to action (owner decision 2026-11-05)

A button that starts registration on a public page opens a small email box in place instead of loading the first question (`StartLink` and `StartGateHost`, `src/components/onboarding/`; copy and the payoff lines in `src/lib/onboarding/start-gate.ts`; server action `captureStartEmail`). The box says what the email buys (the jobs that fit, a first-week plan, a starting grade with a résumé), takes the email, starts the profile with it, files the lead and goes on to the first question, which restates the same payoff (`PathPayoff`, also on the account step). Rules:
- Every public registration button uses `StartLink`, never a bare link to `/onboarding/desire`. It is still a real link (no script, middle click and crawlers work).
- It never asks twice: the `nc_started` cookie (30 days) skips the box; the box is not used on `/onboarding`, on portal and customer hosts, or after a form that already took the email (job save, recruiter and company interest, the fit check, the journey picker).
- "Continue without saving" goes on without an email; the details step still asks for one before an account.
- Events: `start_gate_opened`, `start_gate_submitted`, `start_gate_skipped`, `start_gate_dismissed`, `start_email_captured` (server), with `source` (which button on which page).
