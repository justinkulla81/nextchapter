# Google OAuth verification packet: NextChapter candidate app

Prepared 2026-10-20. Read-only research; nothing has been submitted, published, or sent.
Status of every claim: **[verified]** means checked in code or on the live site today;
**[estimate]** means a vendor or community figure, so confirm it before you budget.

---

## 0. The decision Justin has to make first (paid, recurring)

Every Gmail scope that can read mail is **Restricted**. That includes `gmail.readonly` and the
"narrower" `gmail.metadata`; see Google's list at
https://developers.google.com/workspace/gmail/api/auth/scopes. A Restricted scope means a **CASA security assessment
every 12 months**, paid to a third-party lab. A narrower Gmail scope does not avoid it.

| Option | What members get | Cost | Time to stop the weekly disconnects |
|---|---|---|---|
| **A. Verify with `gmail.readonly` + CASA Tier 2** (recommended if Gmail tracking is core) | Everything works as today, with no 100-user cap and no warning screen | **[estimate]** $540 to $720 per year at TAC Security (its published "discounted" Basic and Premium prices); about $1.5k to $4.5k per year at other labs. Tier 3, if Google assigns it, costs about $4.5k to $15k+ | **[estimate]** 4 to 10 weeks total (Google review queue plus a 1 to 3 week lab assessment plus Google's final review) |
| **B. Drop Gmail from the candidate app** and keep only `calendar.events.readonly` (Sensitive, no CASA). Replace Gmail sync with "forward job mail to your NextChapter address" (a Gmail filter plus inbound email) | Worse coverage: members must set a filter, and nothing is backfilled. Sent-mail tracking (outreach) is lost. Scam watch only sees forwarded mail | $0 for Google. Engineering work for inbound mail, plus inbound-email costs at Resend or similar | **[estimate]** 1 to 2 weeks to build, then about 1 week for Google's sensitive-scope review |
| **C. Stopgap, do it now under either option:** set the candidate project to **"In production"** without waiting for verification | Refresh tokens stop expiring after 7 days. Members see a one-time "Google hasn't verified this app" screen (Advanced → Go to NextChapter). Capped at **100 users** lifetime | $0 | Immediately. Each member reconnects **once** after the switch |

**Recommendation: do C today, then choose A or B.** Option C is free and fixes the weekly
disconnects for the members we have now (we are under 100 Gmail-connected members, and the
code's own tester allow-list in `isGmailTrackingTester` still keeps it from growing by accident).
Option A is the right long-term answer if Gmail-based application tracking, Candidate+ credit,
and skills match/gap reports stay core. **This is a metered/paid decision, so Justin decides. Nothing
here has been bought or submitted.**

> Why gmail.metadata does not help: it is also Restricted (same CASA requirement). It also cannot use the
> `q` search parameter, which our day-by-day sync window (`after:`/`before:`) and platform tracking
> (`from:(...) newer_than:`) depend on. And it cannot see body text or attachments, so it would miss
> rejections, interview invites, and resume attachments. The code already moved off `gmail.metadata`
> for this reason (see the comment in `src/lib/email-tracking/gmail-oauth.ts`). Gmail has no
> scope limited to a label or a search query. The only non-Restricted Gmail scopes are `gmail.labels`
> (label names only), `gmail.send`, and the `gmail.addons.*` scopes (which only work inside a Gmail add-on, for the message
> the user has open, so no background sync).

---

## 1. Scope inventory for the candidate app [verified in code, origin/main e3780e50]

The candidate OAuth client (`CANDIDATE_GOOGLE_OAUTH_CLIENT_ID`) requests the following. The admin flows
(`gmail.send`, `calendar.events`, `documents.readonly`) moved to a separate admin client in Google Cloud
project `nextchapter-admin-511716`, merged to main as 4ae28002. Do **not** add those three
to the candidate project's Data Access page.

| Scope | Requested in | Why it's needed | Google class |
|---|---|---|---|
| `openid` | `src/lib/email-tracking/gmail-oauth.ts` (Gmail and combined connect) | ID token, to know which Google account was connected | Non-sensitive |
| `email` (`.../auth/userinfo.email`) | same | Read the connected account's address. Used for the Confidential Search Mode corporate-domain block and to show "connected as ..." | Non-sensitive |
| `https://www.googleapis.com/auth/gmail.readonly` | `gmail-oauth.ts` | Application/networking tracker (applied, rejection, interview invite, recruiter outreach, follow-ups, resume attachments). Platform tracking (which job boards and learning platforms the member uses). Scam watch. Real-time sync via `users.watch` (optional, `GMAIL_PUSH_TOPIC`) | **Restricted** |
| `https://www.googleapis.com/auth/calendar.events.readonly` | combined connect (`gmail-oauth.ts`) and `src/lib/calendar-tracking/google-calendar-oauth.ts` | Log interviews, networking calls, and coaching sessions. Attendee email for "who you met" follow-ups. Duration for Learning time | **Sensitive** (verification, no CASA) |
| `openid email profile` via **Supabase "Sign in with Google"** (`src/components/auth/GoogleButton.tsx`) | Supabase Auth (its own Google client, configured in the Supabase dashboard) | Sign-in | Non-sensitive. See note 1.1 |

**Minimum set to submit:** `openid`, `.../auth/userinfo.email`, `.../auth/gmail.readonly`,
`.../auth/calendar.events.readonly`. (Option B removes `gmail.readonly`.)

### 1.1 Check before you submit: which project holds the Supabase sign-in client?
Open Supabase → Authentication → Sign In / Providers → Google, and compare its Client ID prefix (the project
number) with `CANDIDATE_GOOGLE_OAUTH_CLIENT_ID`. If both are in the **same** Google Cloud project, that
project has a redirect URI on `uvoulytrsrxasqzutlmq.supabase.co`. Google verification requires every
authorized domain to be one you own and have verified, and we cannot verify `supabase.co`. Fixes, cheapest first:
1. Move the sign-in client to its own project (sign-in-only scopes don't need verification). Update the
   Client ID/secret in Supabase. **$0.**
2. A Supabase custom auth domain (Pro plan plus the custom-domain add-on). **[estimate]** about $35/month. This
   was deferred on 2026-07-10.

If they are in different projects, nothing changes.

### 1.2 What we store from Google [verified in code]
- **Gmail:** Gmail message ID and thread ID, direction, date, sender/recipient address, subject, our
  classification (activity type, company, role, confidence, matched rule), whether a resume was attached
  (`TrackedEmailActivity`). Job applications detected from mail (`JobPosting.appliedAt`, `interviewLandedAt`).
  Platform badges. Scam alerts keep sender, subject, date, and the reasons. **Message bodies are read in memory
  (capped at 4,000 characters) for keyword matching and are never stored.** No Gmail content is sent to
  an AI model. (Only the newsletter sweep on the *admin* client sends mail text to Anthropic.)
- **Calendar:** event ID, title, start time, duration, classification, first non-self attendee email
  (`TrackedCalendarEvent`).
- **Tokens:** encrypted at rest (`src/lib/security/token-crypto-extension.ts`).
- **Derived data shown to AI:** the Market Reality report prompt includes job URLs where an interview or offer
  was recorded (which can come from Gmail detection) and "Gmail connected: yes/no". This is derived
  data, not message content. It's covered by the Anthropic disclosure, but the policy should say so (see section 7).

---

## 2. App information (Branding page)

| Field | Value | Status |
|---|---|---|
| App name | **NextChapter** | Must match the name on the homepage (the title is "NextChapter: Welcome to your Next Chapter") [verified] |
| User support email | **justin@launchyournextchapter.com** | Must be a Google account you own or a Google Group you manage in the project's org |
| App logo | 120×120 PNG, NextChapter mark | Uploading a logo triggers brand review. Use the same mark as the site |
| App home page | https://launchyournextchapter.com | 200, links to the privacy policy and terms [verified] |
| Privacy policy | https://launchyournextchapter.com/privacy-policy | 200, lists the scopes and the Limited Use sentence [verified]. Gaps in section 7 |
| Terms of service | https://launchyournextchapter.com/terms | 200, covers connected Google accounts [verified] |
| Authorized domains | `launchyournextchapter.com` | Covers `candidate.launchyournextchapter.com` redirect URIs |
| Developer contact | justin@launchyournextchapter.com | |

**Redirect URIs that must be on the candidate client (and nothing else):**
- `https://candidate.launchyournextchapter.com/api/auth/google-connect/callback`
- `https://candidate.launchyournextchapter.com/api/auth/gmail/callback`
- `https://candidate.launchyournextchapter.com/api/auth/calendar/callback`

Remove any `/api/google/oauth/callback` or webinar-calendar URIs from the candidate client. Those belong to the
admin client now.

### What Google checks on these pages
- **Homepage:** describes what the app does, is publicly reachable without sign-in, shows the app name, and links to the privacy policy.
- **Privacy policy:** on the same authorized domain. It must say what Google user data is accessed, how it's used,
  stored, and shared, the Limited Use statement, how to revoke access, and **how to request deletion**.
- **Terms:** reachable, on the authorized domain.

---

## 3. Domain verification (Search Console)

1. Open https://search.google.com/search-console, then Add property, then **Domain**, and enter `launchyournextchapter.com`.
2. Copy the `google-site-verification=...` TXT record and add it at the DNS host for launchyournextchapter.com.
3. Click **Verify**. It's usually minutes, up to 48 hours.
4. The Google account that verified it must be an **Owner or Editor of the candidate Cloud project**. If the
   verifying account is the NC Workspace account and the project is under justin.kulla@gmail.com (or the other way
   round), add the other account as an owner in Search Console (Settings, then Users and permissions).
5. Back in Cloud Console, open Branding and confirm `launchyournextchapter.com` shows as verified under Authorized domains.

---

## 4. Scope justifications (paste into Data Access, one per scope)

**`https://www.googleapis.com/auth/gmail.readonly`**
> NextChapter is a job-search tracker for people looking for work. When a member connects Gmail, we
> automatically log their job-search activity, so they don't have to enter it by hand: applications they submit
> (confirmation emails from employers and applicant tracking systems), replies such as rejections and interview
> invitations, recruiter outreach, follow-up and thank-you notes they send, and whether a resume was attached.
> We also flag recruiter and interview emails that show signs of a fake-job or fake-recruiter scam, and warn the
> member. We need gmail.readonly because a narrower scope cannot do this. gmail.metadata cannot read message
> bodies or attachments, where rejection and interview wording and resumes appear, and it cannot use search
> queries, which we use to fetch mail by date and by known job-platform senders. We only read mail; we never send,
> modify, or delete it. Message bodies are processed in memory and not stored. We store only the sender, subject,
> date, message ID, and our classification, shown only to the member. Data is not sold, not used for
> advertising, and not used to train AI models.

**`https://www.googleapis.com/auth/calendar.events.readonly`**
> When a member connects their calendar, NextChapter automatically logs job-search events: interviews,
> networking calls, and coaching sessions. These appear in the member's tracker and count toward their weekly
> progress, and the member gets a reminder to follow up with the person they met. We read event title, time,
> duration, and attendees. We cannot create, change, or delete events. The read-only events scope is
> the narrowest scope that exposes event titles and attendees.

**`openid` / `.../auth/userinfo.email`**
> Used to identify which Google account the member connected, so we can show "connected as ..." and block
> connecting a current-employer work account when the member has Confidential Search Mode on.

**Gmail use-case category to select (if asked):** Productivity / CRM-style tracking of the user's own job-search
correspondence, plus security (scam detection). The data is shown only to the user who connected it.

---

## 5. Limited Use disclosure (required wording)

Google requires this sentence, or one equivalent to it, on the privacy policy (it's already live on our policy) **[verified]**:

> NextChapter's use and transfer of information received from Google APIs will adhere to the
> [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
> including the Limited Use requirements.

Also put the same sentence on the homepage footer or the in-app connect screen (optional, but it helps reviewers).

---

## 6. Demo video script (2 to 3 minutes, English, upload to YouTube as **Unlisted**)

Record with a real test Gmail account that has a few job emails in it (an application confirmation, a rejection,
an interview invite) and one calendar event titled like an interview.

| Time | Show | Say |
|---|---|---|
| 0:00 to 0:15 | https://launchyournextchapter.com, then scroll to the footer Privacy link | "This is NextChapter, a job-search tracker. Here is our privacy policy." |
| 0:15 to 0:30 | Sign in, go to Dashboard, then the Connect Google prompt | "A member connects Gmail and Calendar from their dashboard." |
| 0:30 to 1:00 | Click Connect. **Pause on Google's consent screen with the address bar visible**, then zoom in on the URL so the `client_id=` value shows. Read out the app name and each permission | "The consent screen shows the app name NextChapter and the client ID ending ...[last 6 digits]. We request read-only Gmail, read-only Calendar events, and email address." |
| 1:00 to 1:40 | **gmail.readonly:** Dashboard, then the Email activity / Applications tracker. Show the application, rejection, and interview rows created from the test emails. Open Scam watch, and show the Network follow-ups | "Gmail read-only lets us detect applications, replies, and interview invites, and log them automatically. It also lets us flag fake-recruiter emails. We only show this to the member." |
| 1:40 to 2:05 | **calendar.events.readonly:** show the interview event logged in the tracker or Learning time | "Calendar read-only logs interviews and networking calls. We can't change events." |
| 2:05 to 2:40 | **Deletion:** Dashboard, then Privacy, then Disconnect Gmail and Calendar. Then show myaccount.google.com/connections, where NextChapter is gone (the grant was revoked). Show the privacy policy deletion paragraph | "Members can disconnect at any time. That stops syncing and revokes our Google access. To delete the data we derived, members click [Delete my Google data] or email support, and we delete it within 30 days." |
| 2:40 to 2:50 | Close on the privacy policy Google section | "Our use follows the Google API Services User Data Policy, including Limited Use." |

> Do the deletion segment only after the "Delete my Google data" control from section 8 ships. Otherwise, say "email
> support@launchyournextchapter.com" and show the policy text.

---

## 7. Privacy policy gaps and exact additions (draft only, not published)

The current policy (`src/app/privacy-policy/page.tsx`, effective 2026-10-14) already lists the scopes, the Limited Use
sentence, "no ads / no training / no human reading", and the disconnect path. What's missing or would draw a
reviewer's questions:

1. **No Google-specific deletion path or timeline.** Section 6 says permanent deletion is "email support", and
   section 7 says deletion is "immediate". These conflict, and neither mentions Google data.
2. **What we store is not listed.** Reviewers want to see that bodies are not stored.
3. **Platform tracking is not described** under gmail.readonly.
4. **Section 4 (AI) doesn't say whether Google data goes to Anthropic.**
5. **Wrong location in the app:** it says "Dashboard → Settings", but the controls are at **Dashboard → Privacy**.
6. **Coach visibility:** derived counts can reach a member's coach with consent. Say so.

**Add after the `calendar.events.readonly` bullet (inside "Google permissions we request"):**
> We also use gmail.readonly to recognize emails from job boards and learning platforms you use (for example,
> an application confirmation from a job board or a course-completion email), so we can show which platforms
> you're active on.

**Add a new subsection "What Google data we keep" before "Scam watch":**
> **What Google data we keep.** We read message content only to classify it, and we don't store email
> bodies or attachments. For each job-search email we recognize, we keep the sender and recipient
> addresses, subject, date, Gmail message and thread IDs, whether a resume was attached, and what we detected
> (for example, "interview invite from Acme"). For calendar events we recognize, we keep the event title, time,
> duration, and the other attendee's email address. We don't keep anything from emails or events we don't
> recognize as job-search activity. Your Google access tokens are encrypted at rest. This information is shown
> only to you, and to your coach only if you turn on coach sharing. Your coach sees counts and activity types,
> never email subjects or contents.

**Add to the paragraph that ends "...aggregated and anonymized for internal operations.":**
> We don't send the contents of your email or calendar to any AI provider. Activity we detect from them, such as
> "interview landed at Acme", may be included in the AI-generated reports we create for you (see Section 4).

**Add a new subsection "Disconnecting and deleting your Google data" after the Limited Use paragraph:**
> You can disconnect Gmail and Calendar at any time from Dashboard → Privacy. Disconnecting stops all syncing
> immediately and revokes NextChapter's access in your Google Account. You can also remove access at
> https://myaccount.google.com/connections. To delete the data we created from your Gmail and Calendar,
> use "Delete my Google data" on Dashboard → Privacy or email support@launchyournextchapter.com. We delete it, along
> with your stored Google tokens, within 30 days, and from backups within 90 days. Deleting your account deletes
> all of it.

**Edit:** in "2. Connected Accounts", change "Dashboard → Settings" to "Dashboard → Privacy" (two places).
**Edit:** in "7. Data Retention", replace "deleted immediately" with "deleted within 30 days of your request" so
it matches section 6. (Check this against what support actually does.)

---

## 8. Code gaps that a reviewer can see (not fixed here; small follow-ups)

1. **Disconnect keeps encrypted tokens.** `disconnectGmail` (`src/app/dashboard/email-activity/actions.ts`) sets
   `disconnectedAt` and revokes the grant, but leaves `accessToken`/`refreshToken` on the row. Blank them on disconnect.
   The same applies to Calendar.
2. **No self-serve deletion of Google-derived data.** Add "Delete my Google data" on Dashboard → Privacy. It would
   delete `TrackedEmailActivity`, `TrackedCalendarEvent`, the Gmail-sourced scam alerts, and the `EmailConnection` and
   `CalendarConnection` rows. Decide whether Gmail-created `JobPosting` rows go too. If this doesn't ship, the
   email-support path in section 7 is acceptable to Google.
3. **After approval:** remove the tester gate (`isGmailTrackingTester` checks in
   `src/app/api/auth/{gmail,google-connect}/start/route.ts`, and `isCalendarTrackingTester` in `src/app/api/auth/calendar/start/route.ts`), and drop the "Testing-mode 7-day"
   comments.

---

## 9. Step-by-step checklist (with direct links)

Find the candidate project first: open https://console.cloud.google.com/auth/clients and pick the project whose
client ID equals `CANDIDATE_GOOGLE_OAUTH_CLIENT_ID` in Vercel. The project number is the digits before the first `-`.
Memory notes say it is probably `neon-semiotics-510914-q9`, but that's unconfirmed. Use the account that owns that project.
Below, `PROJECT` is that project ID.

**Today (stopgap, $0):**
- [ ] 1. **Audience:** https://console.cloud.google.com/auth/audience?project=PROJECT, then **Publish app** (Testing → In production). Confirm.
- [ ] 2. Ask current Gmail-connected members to reconnect once (Dashboard → Connect Google). New tokens won't expire after 7 days. Check one account a week later.

**Verification submission:**
- [ ] 3. **Search Console** domain property for launchyournextchapter.com (section 3): https://search.google.com/search-console
- [ ] 4. **Branding:** https://console.cloud.google.com/auth/branding?project=PROJECT. Fill in from section 2 and save.
- [ ] 5. **Clients:** https://console.cloud.google.com/auth/clients?project=PROJECT. Trim the redirect URIs to the three in section 2.
- [ ] 6. **Supabase check** (section 1.1).
- [ ] 7. **Data Access:** https://console.cloud.google.com/auth/scopes?project=PROJECT. Add exactly `openid`, `userinfo.email`, `gmail.readonly`, `calendar.events.readonly`, and paste the section 4 justifications. Remove anything else.
- [ ] 8. Ship the section 7 privacy policy additions (a code change, after your review).
- [ ] 9. Record the section 6 video, upload it to YouTube as Unlisted, and paste the link.
- [ ] 10. **Verification Center:** https://console.cloud.google.com/auth/verification?project=PROJECT, then **Prepare for verification**, then Submit. (Legacy page: https://console.cloud.google.com/apis/credentials/consent)
- [ ] 11. Watch justin@launchyournextchapter.com and the project-owner inbox for Google's Trust & Safety emails. They often ask follow-up questions, and you reply in the same thread.

**CASA (Option A only, after Google's email with the CASA tier and portal link):**
- [ ] 12. Pick a lab and buy the tier Google assigns. Run the scan they specify, fix the findings, and get the Letter of Validation.
- [ ] 13. Upload the LoV, or the lab sends it to Google. Google completes verification. Put a reminder 11 months out for the annual renewal.

---

## 10. CASA notes

- **What it is:** Cloud Application Security Assessment, run under the App Defense Alliance on OWASP ASVS.
  Google requires it for apps that access Restricted-scope data on a server. NextChapter syncs Gmail
  server-side, so it applies.
- **Tier:** Google assigns the tier in its email. Most restricted-scope apps get **Tier 2** (the lab
  validates a developer-run scan plus a questionnaire). **Tier 3** (a full lab-run test) is for higher-risk or larger apps.
  **[estimate]** Expect Tier 2.
- **Cost [estimate]:** Tier 2 is about $540 (TAC Security Basic) to $720 (TAC Premium) per app per year at TAC's
  listed prices, and about $1.5k to $4.5k at other labs. Tier 3 is about $4.5k to $15k+. Google charges nothing itself.
- **Timeline [estimate]:** about 1 to 3 weeks for the lab (longer if the scan finds issues), plus Google's own review before
  and after. That makes about 4 to 10 weeks end to end. Renew **every 12 months**. A renewal with unchanged scopes is lighter.
- **Authorized labs:** the ADA page https://www.appdefensealliance.org/certification/authorized-labs lists Bishop Fox,
  DEKRA, NetSentries, and TAC Security with CASA-specific pages. It also lists ValueMentor and Prescient Security, which may also
  do CASA, so confirm with them. Confirm the current list on that page before buying.
- **Prep that shortens it:** tokens are already encrypted at rest; TLS everywhere (Vercel); no email bodies stored; least-privilege scopes; access logging on admin; dependency scanning. The lab's scan will likely flag
  security headers (CSP/HSTS) and any outdated npm packages, so fix those before the scan.

Sources (cost and timing are vendor pages; treat them as estimates):
[Gmail scope classes](https://developers.google.com/workspace/gmail/api/auth/scopes) ·
[ADA authorized labs](https://www.appdefensealliance.org/certification/authorized-labs) ·
[TAC ESOF/CASA FAQ](https://tacsecurity.com/?p=18721) ·
[Switchlabs CASA pricing comparison](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option) ·
[Nango Google security review](https://nango.dev/docs/api-integrations/google-shared/google-security-review) ·
[Unipile refresh-token 7-day note](https://www.unipile.com/google-oauth-refresh-token/)
