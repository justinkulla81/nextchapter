# Onboarding flow (final)

The owner has decided this order. Do not design against another order or re-add the old steps. Built behind `ONBOARDING_BUNDLES=on` (branch `claude/onboarding-google-account-step`).

1. Questions, with "Where you are" (journey) first.
2. Résumé. Never required (owner decision, 2026-10-29): anyone may skip it, Market Reality arrivals and unemployed journeys included, but the upload is the main action and skipping is a small link under it. Skippers go to the details step (`/onboarding/details`: first name, last name, email, LinkedIn optional) and are prompted on Home to "Upload your résumé to get your Market Reality". The same details step runs when a résumé is read but held no name or email. No account can be created without a name and an email (`needsContactDetails`, `src/lib/onboarding/details.ts`), and a registered member with no name on file is asked once on the dashboard.
   The upload returns as soon as the file is stored (`startResumeUpload`); reading it, the profile fill and the analysis run afterwards (`src/lib/resume/background-parse.ts`) while the page shows progress. State lives in `journeyDetails.resumeParse`; a Resume row counts as a résumé only once reading has finished. Failure shows "Try again" / "Upload a different file".
   The read is two model calls that start together (`src/lib/resume/extract-profile-fields.ts`): a quick one (contact details, function, level, latest title, dates, keywords) that hands the member on to step 3, and a long one (every school and job, AI readiness) applied behind the handover. Step 3's live job count is `/api/onboarding/match-preview`, a route and not a server action, so it never queues in front of Continue. Timings: `resume_parse_completed.stages`, `onboarding_step_rendered`, `onboarding_match_preview`.
   While the file is chosen, uploaded and read, the résumé step loads the job board into server memory (`/api/onboarding/warm`, `onboarding_board_warmed`), and the analysis that follows the read runs in its own invocation (`/api/internal/resume-analysis`, falling back to running inline; `resume_analysis_dispatched`). The pre-account question pages read the session from the token claims (`getSessionIdentity`) and skip the registration sync.
3. Aiming, level and function (asked directly if there is no résumé).
4. Where.
5. Coach.
6. The account step, one required screen that creates the account. **While Google connect is off (until CASA, set by `GOOGLE_CONNECT_ENABLED`, default off; `src/lib/google/connect-switch.ts`) it is an email and a password**, confirmed by a link (`/onboarding/create-account`); the Google reveal after sign-up is skipped. **When Google connect is on** it is one "Continue with Google" that creates the account and connects Gmail and Calendar (`/onboarding/connect`), followed by the optional Google reveal for members who registered under the earlier order. Nothing in the candidate area waits on a Google connection while it is off (Victoria's weekly advice, the Weekly Sprint rows, the connect-accounts note, the Network and activation locks).
7. Payoff: what the scan found, what you gained, and the starting grade only if there is a résumé.
8. Welcome.

## Light accounts: an account before the questions (owner decision, 2026-11-18)

Most people who give us an email on a public page (the Apply box on a job, a saved job, a job alert, the newsletter) never start
the questions above: 330 Apply clicks a month, 71 emails, 2 accounts (30 days to 2026-11-17). So the follow-up emails' main button,
"Open my free account", opens `/onboarding/account-ready?t=<token>`: their saved job, first and last name, one button.

- The link is a signed, dated token good for 30 days (`src/lib/leads/light-account.ts`); the button press, not the link, opens the
  account, so a mail scanner that follows the link opens nothing.
- The account is an email user with no password (`signInVerifiedEmail`, the same path as the Google join), with the name and email
  on the profile (so "no account without a name and an email" still holds), `lightAccountAt` stamped, saved jobs claimed and the
  CRM record linked. A full member is sent to sign in instead; an account still waiting for its own confirmation is never entered.
- A light member lands on `/onboarding/your-jobs`: their saved jobs and one action, "See my fit", which is step 1 above. The full
  member area stays closed until the questions are done.
- Registration (`registrationCompletedAt`) waits until every question before the account step is answered
  (`lightAccountQuestionsDone`, checked in `syncRegistrationCompletion`), then the order continues at 7. The account step itself
  is skipped: they already have one. To get back in later they use the newest email's button, or "Forgot password" on the sign-in
  page to set a password.

While Google connect is on, people with no personal Gmail leave their email on a waitlist, and connecting is limited to testers until Google approves the app. Setup: `docs/SETUP.md`.
