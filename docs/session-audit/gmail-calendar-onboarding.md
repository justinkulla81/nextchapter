# Audit: Gmail and Calendar onboarding work

Read-only audit, 2026-10-18. Compared against `docs/candidate-redesign.md`, the personalization bundles (O1 to O6, N3), `docs/finances-and-benefits.md` and `src/lib/nav/redesign-places.ts`.

## 1. What it is and where it lives

### Merged into `main` (live code, working today)

The connection machinery. One Google consent, `gmail.readonly` + `calendar.events.readonly` + `openid email`, read-only.

| Piece | Where | What it does |
|---|---|---|
| Start routes | `src/app/api/auth/google-connect/start`, `/gmail/start`, `/calendar/start` | Begin consent. Gated by `isGmailTrackingTester(email)` (`src/lib/email-tracking/gmail-oauth.ts`) while Google verification is pending. A member who is not on the list triggers `notifyAdminGmailAccessNeeded` (an email to the admin). |
| Trust dialog | `src/components/dashboard/ConnectGmailCalendarButton.tsx` | Pre-consent popup. Lists benefits (cadence, fit feedback, Search Strategy, Dossier) and limits (read-only, only outreach/replies/invites/calls, disconnect any time). Fires `gmail_connect_trust_dialog_*`. |
| Prompts | `GoogleConnectPrompt.tsx` (Find a job and Network pages), `PreConnectDailyMessage.tsx` (Home daily message, replaces the normal one until connected), `ReconnectBanner.tsx` (Find a job, Network, Home link variant) | The three nags. They quote "+20 pts", "+10 pts", "+5 pts". `connectReason(journey)` gives a journey-specific reason. |
| Sync | `src/lib/email-tracking/sync-gmail.ts`, `classify-email.ts`, `gmail-push.ts`; `src/lib/calendar-tracking/*` | Classifies mail into APPLICATION_CONFIRMATION, INTERVIEW_INVITE, NETWORKING_OUTREACH, INTRO_REQUEST, FOLLOW_UP, THANK_YOU, REJECTION; calendar events into INTERVIEW and NETWORKING_CALL. Auto-adds contacts (`upsertContactFromSignal`, `addAttendeesToNetwork`) and creates applications (`EMAIL_DETECTED`). First backfill is 90 days. |
| Tester allow-list | `CandidateProfile.gmailTrackingTesterEnabled` (default true), `TrackingTesterAllowlistEntry`, env `GMAIL_TRACKING_TESTER_EMAILS`; admin page `https://admin.launchyournextchapter.com/support/admin/tracking-testers` | Hard gate while the app is unverified. |
| Corporate block | `google-connect/callback`: `corporate_domain_blocked` when Confidential Search Mode is on and the Google address looks corporate | Privacy protection for people hiding a search. |
| Menu lock | `src/lib/nav/places.ts` `GMAIL_LOCKED` (Find a job, Network, Contacts), reason in `GMAIL_LOCK_REASON` | Tab is locked until `hasEmailConnection`. Read by `lockReasonFor`, which `redesign-places.ts` also uses. |
| `google-oauth-split` | Admin Google client separated (`src/lib/google/admin-client.ts`) so the candidate app's verification covers only the two read-only scopes | Equivalent change is already in `main` (commit 4ae28002); the branch copy 15d23604 is a duplicate, safe to drop. Admin only. |
| `calendar-accounts` | Admin CRM/webinar calendar sweep reads every connected Google account | Equivalent change is already in `main` (37b7d602). Admin only. Nothing for candidates. |

Settings: connect/disconnect lives on Profile ("Connected accounts", question row 190). Disconnect from Settings is promised in the dialog.

### Only on a branch (not merged, nothing live)

1. `origin/claude/optimistic-goldberg-fxjmxq`, "Onboarding v2: Google sign-up page and scan reveal, behind a flag". 5 commits, 30 files, 1,607 lines. Spec in that branch's `docs/onboarding-v2.md` (217 lines). Branched from an older `main` and written against the old six-place redesign, not the current one.
   - `/onboarding/join` (https://launchyournextchapter.com/onboarding/join): "Continue with Google" or "Continue with email instead" (`/onboarding/desire?classic=1`).
   - `/api/auth/join/start` and `/callback`: one consent for sign-in (plus Gmail and Calendar with the second flag). Nonce-checked. Rejects Workspace accounts (`hd` claim) and non-personal Gmail. Creates or signs in the account via `verified-email-session.ts` (uses `SUPABASE_SERVICE_ROLE_KEY`). Starts the first inbox read in the background. Tester gate: non-listed members get an account with tracking `pending` and an admin email.
   - `/onboarding/reveal` (https://launchyournextchapter.com/onboarding/reveal): `ScanReveal.tsx` polls every 3 s for up to 6 minutes. Shows a progress bar, then three numbers: applications, interviews, networking ("about N"), plus a calm line for rejections. Meanwhile the situation card (`SituationForm`) is asked. One button then goes to the old `/onboarding/welcome`.
   - Flags: `ONBOARDING_V2=1` (sign-up page and reveal, routes new visitors away from classic), `ONBOARDING_V2_CONNECT=1` (also ask for Gmail and Calendar).
   - Also changes a live path: `google-connect/callback` now checks granted scopes before saving either connection (unticking one box used to save both). Also removes the connect points from the sprint.
   - Not run against real Google or Supabase (its own doc says so). Redirect URI `/api/auth/join/callback` must be registered. Unit tests only.
   - Specced but not built: the five "Make it yours" cards, the effort fix, friends and family tagging, soft gates.
2. `origin/claude/diane-information-pickup-71yfy7`: one commit, `extension/popup.js` reads sender name, email, role, organization and phone from an open Gmail message (`mail.google.com` branch), version 1.8.2. Not merged. This is the admin CRM "NextChapter Capture" extension (needs a capture token created in the admin). It is not a candidate feature and has nothing to do with Google OAuth. Keep it out of the candidate redesign. Privacy note: it scrapes the DOM of the admin's own mailbox, so it is fine for the owner but must never be offered to members.

### Existing classic onboarding (merged)

Hub `src/app/onboarding/page.tsx` redirects in order: desire (situation) > resume > confirm > location > comfort > contract > coach-consent > coaching-form > score > welcome > dashboard. Create-account page is separate. Nothing in it asks for Gmail or Calendar. Connect is first offered on Home (`PreConnectDailyMessage`) and then on Find a job and Network.

## 2. How it fits the redesign

**Where the reveal sits.** The reveal is a receipt, not a bundle. It belongs directly after O1 (situation, plus O6 money) and before O2 (résumé). Reason: O1 is the only thing needed to build the first week, and the inbox scan needs about a minute, so the situation card and the money question are exactly what the member answers while it reads. This is the v2 branch's own idea and it matches the redesign rule "every question shows its payoff".

Proposed order: Join with Google (optional) > O1 situation + O6 money (during scan) > reveal > O2 résumé (skippable if the scan already gave us enough) > O3 aim > O4 where > O5 coaching > First week.

**Can it replace résumé-first onboarding?** Partly, not wholly.
- It can replace the *opening* step. Nothing in O1 needs a résumé.
- It cannot replace O2/O3 (role, function, level, years). The scan finds job-search activity, not work history. The only inferred aim signal is the companies and roles in application confirmations, which is a hint worth showing ("you applied to 6 finance roles, is that what you want?"), not a source of truth.
- Many members will have no personal Gmail, a Workspace address, confidential mode, or will say no. Résumé-first must stay as the other door. The v2 branch keeps it via "Continue with email instead", and also says the résumé becomes optional with an empty-grade message. Under the redesign it should stay a normal, short step (O2) that fills 9 answers.

**What receipt it can show today.**
| Receipt | Possible now? | Source |
|---|---|---|
| "We found 14 applications, 3 interviews, about 9 networking conversations" | Yes (branch only) | `scan-summary-core.ts` |
| "142 contacts found, 12 due a follow-up" (N3's wording) | Not in the reveal. Data exists: sync auto-adds `SupportNetworkContact` rows, and follow-ups are already classified. A count query is small to add. | `upsertContactFromSignal`, `addAttendeesToNetwork` |
| "We found 9 answers" (O2's wording) | No. That is a résumé receipt. Gmail does not give answers to profile questions. It can reasonably say "this saves you 3 questions": application count removes "applications so far / interviews so far" (rows 26, 27, already dropped), recruiter-connected count (149), networking level (146). Say that instead of a made-up number. |
| "6 people you know work at your target companies" (N1) | Not yet. Needs the contact-to-company match plus target companies. |

Counts must stay honest: applications and interviews as numbers, networking as "about". The branch already does this. Do not show contacts as a headline before the member has told us they want contacts used.

**Relation to Network N3 "Connect your people" and the Home note "connect accounts".** They are the same consent, three entry points. Make one component, one wording, three places:
- Onboarding reveal: the first and best moment (nothing else to read yet, and the payoff is on the screen).
- N3 on Network: the "later" door for anyone who skipped. Receipt "142 contacts found, 12 due a follow-up". Also holds the LinkedIn import.
- Home note: today `PreConnectDailyMessage` replaces the daily message with two asks (LinkedIn and Gmail). The redesign allows exactly one note on Home, so this becomes one candidate for the single note, shown only when connecting is the best next thing, with one reason.
Disconnect and status belong in Account and privacy (Connected accounts, plus the privacy preview in N4).

## 3. Conflicts with the redesign and other work

1. **Two onboarding flows.** The v2 branch adds a second front door beside the classic hub, switched by `ONBOARDING_V2`. The redesign onboarding (`moments.tsx` OnboardingSituation, OnboardingMoney, FirstWeek, bundles O1 to O6) is a third design. Decide that the redesign's O1 to O6 is the only flow and Google join is an optional first screen of it, not a separate path with its own welcome and `/onboarding/reveal` step list.
2. **Flag overlap.** Three flags would be live: `CANDIDATE_REDESIGN` / `CANDIDATE_REDESIGN_EMAILS` (menu, pages), `ONBOARDING_V2` and `ONBOARDING_V2_CONNECT`, plus the tester gate `gmailTrackingTesterEnabled`. A redesign member could land in classic onboarding or the reverse. Recommend: v2 flags only control the Google button; the redesign flag controls the whole onboarding. Keep `ONBOARDING_V2_CONNECT` (it is the Google-verification switch) and rename it after merge.
3. **Join is a registration path.** The v2 callback creates accounts with the service role key. That touches auth, `registrationCompletedAt`, the `create-account` page and the anonymous Market Reality session ("A visitor with an anonymous session is signed into the Google account and the anonymous profile is left behind", the branch admits). The redesign has not decided about that anonymous door.
4. **Required vs optional.** The redesign says Gmail and Calendar are optional and explained by their benefit. Join page wording ("Connecting ... lets us track that work for you, and show employers it is real") ties the connect to employer-verified effort, which pushes it toward a requirement. Also `GMAIL_LOCKED` makes Find a job and Network unusable without it (below). Fix both.
5. **The Gmail lock (`GMAIL_LOCKED`) must go.** `redesign-places.ts` reuses `lockReasonFor`, so Jobs > Find a job, Network > Network and Network > Contacts stay locked behind Gmail in the redesign. That breaks: (a) "nothing is forced", (b) "contacts first" on openings, (c) the page contract (one primary action; a lock replaces the page), (d) members with confidential mode or Workspace email, who are blocked from connecting at all (`corporate_domain_blocked`), so they could never open Find a job. Drop the three entries and `GMAIL_LOCK_REASON`; keep the status-based locks. Without Gmail the pages open with manual logging and one honest line saying what connecting adds.
6. **Points wording vs "1 point = 1 minute".** All three prompts say "+20 pts", "+5 pts" for connecting. The v2 branch correctly stops awarding sprint points for connecting ("setup is not effort") and says sumEffortMinutes counts GMAIL_CONNECTED / CALENDAR_CONNECTED, which inflates Candidate+ minutes. That fix belongs to the effort code owned by the redesign. If the points go, every "+N pts" string in the three components must go too, or the prompt promises something that no longer happens.
7. **Consent and privacy wording is inconsistent in three places.** Trust dialog: "nothing else is read or stored." Join page (v2): "We keep ... the company, role, date and subject line, not the text of your messages." Privacy policy and `docs/PRIVACY_COPY_DRAFT_2026-10-15.md` have their own text. The sync does read bodies (`gmail-body.ts`, scope is `gmail.readonly`) and stores classified activity and contacts. One sentence set, checked against what is stored, should be used everywhere, and the auto-added contacts (other people's names and emails) should be named in it. Contacts are third-party data, which the current text does not say.
8. **Money.** The redesign says money is opt-in and "asked right after O1". The scan can see severance, unemployment and benefits emails, but must not be used to infer or show money facts when the member said no. The classifier should not surface financial email as a finding unless money help is on. Check `classify-email.ts` has no financial categories (none seen in the type list above).
9. **Reveal has no home in the new page contract.** `ScanReveal` plus the situation card plus a button is two sections and two actions on one screen, with the situation form's "Save my answer" and "See how NextChapter works" showing at different times. OK in principle; needs the dev-preview treatment first (see steps).
10. **Design principles.** Reveal uses `rounded-xl border bg-white` cards, `text-navy` for ordinary numbers (navy is reserved for one unlock moment per page), and no `cursor: wait` on the Google button. Join is a single big button, which is correct. Button label "Continue with Google" is an action, fine. "See how NextChapter works" is the old welcome step, which the redesign's First week replaces.
11. **Branch drift.** The v2 branch was written against `claude/candidate-dashboard-redesign-djr3g2` as it was (Personalize place, five "Make it yours" cards in My search). The redesign has since removed Personalize and re-homed everything, so its alignment table and the five cards are stale (section 4). Files both touch: `OnboardingStepper.tsx`, `DashboardNav.tsx`, `dashboard/page.tsx`, `effort-minutes.ts`, `search-strategy.ts`, and now `places.ts`. The working tree here has uncommitted edits to `places.ts` and `dashboard/layout.tsx` from another session, so a merge now would collide.
12. **Google verification is unrecorded.** `docs/SETUP.md` on main still says no candidate OAuth is configured, while `GMAIL_TRACKING_TESTER_EMAILS` and the allow-list exist, so the app is in testing mode. In testing mode refresh tokens expire about every 7 days (the code comments say so), which explains `ReconnectBanner`. Until verified, any member-facing "scan reveal" promise is false for anyone not on the list. The branch handles this with the `pending` state, which is honest.

## 4. Old or does not fit

- **Five "Make it yours" cards** in the v2 spec (Your goal, plan, dealbreakers, strengths, people): superseded by bundles O3/O4/O5, H, J and N. Do not build them. Keep only the idea of fast lane then one question at a time on Home.
- **Alignment table in `onboarding-v2.md`**: refers to six places with Personalize; the redesign now has seven (Finances and benefits, Account and privacy) and no Personalize.
- **"Exclusive jobs stay a Candidate+ unlock", "Apply with Dossier", auto-apply**: product decisions outside onboarding. Leave them out of this track.
- **Family and friends tagging**: good idea, belongs to Network contacts (N3/N2), not onboarding.
- **Contract (8 to 12 hours) moving to the first sprint**: already decided in bundles ("contract dropped from onboarding").
- **`PreConnectDailyMessage`**: its "LinkedIn + Gmail" double ask and "Welcome, {firstName}!" daily-message card conflict with one note on Home. Replace.
- **`GoogleConnectPrompt` on Find a job and Network**: working pages carry no note and no prompt in the redesign. Move to N3 on Network (as the strip "Warmer introductions") and Account and privacy. Remove from Find a job.
- **`ReconnectBanner` on Find a job**: a broken connection is the one reason to interrupt a working page, but keep it as a single small line, not the red callout with a points promise.
- **Admin extension branch and `calendar-accounts`/`google-oauth-split`**: admin-side, no candidate effect. The two admin branches are already in `main` in equivalent form; their branch copies can be deleted.
- **`/onboarding/comfort`, `/onboarding/contract`, `/onboarding/score`** in the classic hub: already marked dropped or moved in the bundles; the v2 reveal does not include them.

## 5. New ideas

1. **Two clear doors on one screen.** "Start with Google" (quick: we read your last 3 months) and "Start with your résumé" (we read your history). Both lead to the same first week. Neither is the lesser option (principle: 2 to 4 choices are adjacent buttons).
2. **Say what you will get before the consent.** On the join screen show a sample reveal with sample numbers (the dev-preview way), then the real one. "Here is what you will see in a minute."
3. **Reveal as the Home first view.** Instead of a separate onboarding screen after join, land on Home with a "Reading your search" card that fills in. Home already has the note slot and "Effort and results". The scan result is also the first row of Effort and results ("23 things you already did"), which is motivating: real progress on day one with zero work.
4. **Show the first week from the scan.** If we found 4 applications and no follow-ups, step 1 of the first week is "Follow up on your 4 applications" with the company names. Proof that connecting changed the plan, which is the receipt the redesign wants.
5. **Correct anything wrong.** The branch promises it. Each count opens a short list the member can dismiss (`dismissedAt` already exists). This also earns trust for the contacts count.
6. **A contacts receipt only after consent.** After the reveal ask one yes/no: "Add the 142 people you have written to as contacts?" Default yes, filter automated senders, family and friends tagged, and show the first 5 names. Connected accounts in Account and privacy can later remove them all in one click.
7. **Per-service choice.** "Email only" and "Calendar only" as a two-button choice after the Google screen. Today the scopes are asked together. Google allows granular scopes, and the branch already reads what was granted.
8. **Money-aware.** If money help is on, one line in the reveal: "We found an email about your severance dates. Add it to Finances and benefits?" Only if yes in O6.
9. **Reconnect before it breaks.** A 7-day token expiry in testing mode makes reconnect common. After verification, use `needsReconnectAt` to show one quiet line in Account and privacy; email only after two failed days.
10. **Honest empty state.** When the scan finds nothing (new job seeker, student), say "Nothing yet, that is fine" and skip the reveal entirely for journeys without a search (staying in a job, student). `connectReason(journey)` already has per-journey reasons to reuse.

## 6. Concrete incorporation steps (in order)

1. **Decide** one onboarding: the redesign's O1 to O6. Google join becomes an optional first screen. Retire the v2 spec's five cards and alignment table (append a short "superseded by the redesign" note to the branch spec; do not edit it from here).
2. **Get the v2 branch current.** Rebase `origin/claude/optimistic-goldberg-fxjmxq` onto the redesign branch (not `main`). Resolve `places.ts`, `dashboard/layout.tsx`, `OnboardingStepper.tsx`, `dashboard/page.tsx`. First wait for the other session's uncommitted `places.ts`/`layout.tsx` edits to land.
3. **Drop the Gmail lock.** Remove `GMAIL_LOCKED` and `GMAIL_LOCK_REASON` entries for the three hrefs in `src/lib/nav/places.ts` (and the `hasEmailConnection` parameter if nothing else uses it). Update `src/test/place-tabs-situation.test.ts`. Do this now: it is independent of everything else and unblocks the redesign pages.
4. **Mock first (rule).** Add `src/app/dev-preview/` screens: join (two doors), reveal (reading, done with findings, done with nothing, tracking pending, tracking off), the Home "reading your search" card, N3 "Connect your people", and the Account and privacy "Connected accounts" row. Screenshot and get the owner's approval before wiring.
5. **One wording set.** Write one consent and privacy text (what we read, what we keep, contacts are third-party data, read-only, disconnect, who sees it: nobody else, not employers or coaches) and use it in the trust dialog, join page, N3, `docs/PRIVACY_COPY_DRAFT_2026-10-15.md` and the privacy policy. Remove "+N pts" strings and "show employers it is real" from the connect copy.
6. **Merge the join and reveal behind the flags** once step 2 is clean, with `ONBOARDING_V2_CONNECT` left off until Google verification clears. Register the redirect URI. Run it once against real Google and Supabase (nobody has; the branch says so). Decide the anonymous Market Reality door.
7. **Place the reveal** after O1 and O6 in the redesign order; the situation and money questions are answered during the scan. Replace "See how NextChapter works" with the First week screen. Keep résumé (O2) next, skippable when the scan gave enough.
8. **Add the contacts receipt** (small count query on the auto-added contacts and follow-ups due) and wire the N3 receipt "142 contacts found, 12 due a follow-up" plus the optional yes/no in idea 6. Do not use "9 answers" for the scan.
9. **Collapse the three prompts** (`PreConnectDailyMessage`, `GoogleConnectPrompt`, `ReconnectBanner`) into one `ConnectYourPeople` component used by the Home note (when it is the best next thing), Network N3, and Account and privacy. Remove it from Find a job. Keep the trust dialog.
10. **Fix effort.** Stop connect actions from counting toward Candidate+ minutes (owned by the effort-minutes work). Coordinate before changing `sprint.ts`.
11. **Analytics (project rule).** Keep v2's events (`onboarding_google_started`, `_completed`, `_declined`, `scan_completed`, `scan_reveal_viewed`) and add `connect_prompt_shown { source }`, `contacts_import_accepted { count }`, `scan_item_dismissed { type }`. The v2 doc lists `onboarding_google_*` and `scan_completed` but the code fires only `scan_reveal_viewed`; check which exist.
12. **Cleanup.** Delete the duplicate `google-oauth-split` and `calendar-accounts` branches. Leave the diane extension branch to the admin/CRM track and merge it separately.
13. **Verification gate.** Record Google verification status in `docs/SETUP.md`. Until verified, the join page shows the `pending` state wording and the admin allow-list stays.
