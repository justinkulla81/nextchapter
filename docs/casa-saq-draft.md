# CASA self-assessment draft: NextChapter candidate app

Drafted 2026-10-21 for the Google restricted-scope review (`gmail.readonly` on the candidate
OAuth client, project `project-0ab98e91-a9ef-4edf-a28`). Companion to
`docs/google-oauth-verification.md` on this branch. Nothing here has been submitted to a lab.

**Requirement set used:** App Defense Alliance **CASA Specification v2.1.1 (2026-06-03)**, 48 controls,
each mapped to one OWASP ASVS 4.0.3 requirement.
- Spec: https://github.com/appdefensealliance/ASA-WG/blob/main/CASA/CASA%20Specification.md
- Test guide (what the lab checks per control): https://github.com/appdefensealliance/ASA-WG/blob/main/CASA/CASA%20Test%20Guide.md
- ADA overview: https://appdefensealliance.dev/casa/casa-requirements

**How the assessment works now (so this draft is useful whichever form the lab sends):**
- Google's letter may say "Tier 2". ADA's current pages say **Assurance Level 1 / 2** instead.
  - At AL1 ("verified self assessment"), we submit evidence per control (text, screenshots, code
    snippets) in the lab's portal, and the lab reviews it. This document is that evidence, in draft.
  - At AL2, the lab tests the app itself. The v2 Test Guide makes an authenticated Burp Suite scan
    with ADA's config the primary DAST, so give the lab the test account in Appendix B.
- The old "run your own ZAP / Fluid Attacks scan and upload it" path is marked deprecated on ADA's
  Tier 2 page. It is still a useful readiness check (Section 8).
- Renewal is every 12 months.

**Status key:** **Compliant**: meets the control today (or after the 2026-10-21 fixes, once deployed).
**Partial**: mostly met, with a known hole and a named fix. **Gap**: not met.

## Summary

| Section | Compliant | Partial | Gap |
|---|---|---|---|
| 1. Authentication (8) | 7 | 1 | 0 |
| 2. Session management (9) | 8 | 0 | 1 |
| 3. Access control (9) | 8 | 1 | 0 |
| 4. Communications / crypto (4) | 4 | 0 | 0 |
| 5. Validation and sanitization (11) | 11 | 0 | 0 |
| 6. Configuration (7) | 7 | 0 | 0 |
| **Total (48)** | **45** | **2** | **1** |

Updated 2026-10-21 (second pass) after the Tier 2 fixes on branch `casa-tier2-gaps`. Before: 41 / 5 / 2.

- **The one Gap:**
  - 2.3.2: Supabase session cookies are not `HttpOnly` (deferred, 2 to 4 days).
- **The two Partials:**
  - 1.1.1: brute-force settings (Justin's Supabase dashboard settings, Section 9 item 1).
  - 3.3.1: admin MFA is built and deployed behind `ADMIN_MFA_REQUIRED`; it becomes Compliant when Justin enrolls and turns the flag on.

Effort and fixes for each are in Section 9.

**Fixed 2026-10-21 (CASA prep):**
- Open redirect through `/\host` on `/api/r/[code]?to=`, verified live before the fix, and on the org-portal sign-out.
- `Secure` flag on every session cookie.
- Other sessions are ended after a password reset.
- HSTS now uses `includeSubDomains`.
- Runtime npm advisories are cleared: the mammoth `argparse` override, and the shadcn CLI moved to dev dependencies.
- CI now fails on high runtime advisories.

See Section 9 for the commit.

**Fixed 2026-10-21 (Tier 2 gaps, branch `casa-tier2-gaps`, commit `a025000e`):**
- Browser storage cleared on sign-out (6.6.1).
- Re-auth before Delete my Google data and account deactivation (2.4.1).
- Gmail push verifies Google's OIDC token; `?token=` refused by default (2.1.1, 6.5.1).
- Admin TOTP MFA, behind `ADMIN_MFA_REQUIRED` (3.3.1).
- Supabase advisor `function_search_path_mutable` fixed in production.
- Test: `src/test/casa-tier2.test.ts`.

Paths below are relative to the repo root on `main`.

---

## 1. Authentication

| ID | Requirement (paraphrased) | Status | Our answer and evidence |
|---|---|---|---|
| 1.1.1 (ASVS 2.2.1) | Login resists brute force (approved IdP, or rate limit ≤100 fails/hr/account, CAPTCHA, MFA, or 8+ chars plus breached-password block) | **Partial** | Passwords are handled by Supabase Auth (GoTrue), which rate-limits sign-in and token endpoints per IP. Our own public forms are rate-limited in `src/lib/security/rate-limit.ts`. The sign-up form requires 8+ characters (`src/components/auth/SignupForm.tsx`), and the reset form now does too (`ResetPasswordForm.tsx`). **Missing:** the server-side minimum length and leaked-password protection in Supabase (the security advisor flags `auth_leaked_password_protection`), and no CAPTCHA. Fix: Supabase → Authentication → Policies, set min length 8 and turn on leaked-password protection (Pro plan); or turn on Supabase's Turnstile/hCaptcha. |
| 1.1.2 (2.3.1) | System-generated initial secrets and activation codes are random and expire | **Compliant** | Email confirmation, magic-link and recovery tokens are Supabase-generated and single-use with expiry. App-issued invite and claim tokens use unguessable defaults with TTLs (`src/lib/security/token-defaults-extension.ts`, `token-ttl.ts`: join 90d, scorecard 120d, employer reference claim 180d). We never generate passwords. |
| 1.1.3 (2.4.1) | Passwords stored with a salted, slow hash | **Compliant** | Stored only by Supabase Auth (bcrypt) in `auth.users`. The app never sees or stores password hashes. |
| 1.2.1 (2.5.4) | No default credentials | **Compliant** | There are no shared or default accounts. Admin is an email allowlist (`ADMIN_EMAILS`, `src/lib/admin/is-admin-email.ts`) checked against a real Supabase login. The fixture accounts in `scripts/seed-test-candidates.ts` are created with no password and cannot log in. |
| 1.3.1 (2.7.2) | Out-of-band codes expire quickly | **Compliant** | Supabase email OTP and link expiry (project setting "Email OTP expiration", default 1 hour). *Confirm the value in Supabase → Authentication → Providers → Email before submitting.* |
| 1.3.2 (2.7.3) | Out-of-band codes are single use | **Compliant** | Supabase consumes them on verify. Recovery links are consumed only on submit, so mail scanners can't burn them, and only once (`tokenConsumed` in `src/components/auth/ResetPasswordForm.tsx`). |
| 1.3.3 (2.7.6) | Out-of-band codes are random | **Compliant** | Supabase-generated hashed tokens. |
| 1.3.4 (2.7.6) | Out-of-band codes resist brute force | **Compliant** | Links carry long `token_hash` values, not short numeric codes. Supabase rate-limits `/verify` and OTP sends. |

## 2. Session management

| ID | Requirement | Status | Our answer and evidence |
|---|---|---|---|
| 2.1.1 (3.1.1) | No passwords, session tokens or API keys in URLs | **Compliant** (fixed 2026-10-21) | Session tokens live in cookies. Email action links carry HMAC signatures, not credentials (`src/lib/email/signed-links.ts`). The Gmail Pub/Sub push endpoint now authenticates with Google's OIDC token in the `Authorization` header: RS256 signature against Google's keys, issuer, audience = the endpoint URL, email = our push service account, expiry (`src/lib/email-tracking/pubsub-oidc.ts`, `src/app/api/google/gmail-push/route.ts`). The old `?token=` is refused unless `GMAIL_PUSH_ALLOW_URL_TOKEN=true`, a switch-over setting that is not set. Push is off in production today (no `GMAIL_PUSH_*` variables in Vercel). Coach and recruiter share pages use URL bearer tokens bound to a session (2026-10 audit). The legacy Supabase implicit-flow recovery link can put `#access_token` in the fragment, which is not sent to the server (`ResetPasswordForm.tsx`). |
| 2.2.1 (3.3.1) | Logout and expiry invalidate session and refresh tokens | **Compliant** | Logout calls `supabase.auth.signOut()` server-side, which defaults to global scope and revokes refresh tokens (`src/app/dashboard/actions.ts` `signOut`, `src/app/i/[slug]/(portal)/session-actions.ts`). Deactivation signs out too (`src/app/dashboard/privacy/actions.ts`). |
| 2.2.2 (3.3.3) | Password change or reset ends other sessions | **Compliant** (fixed 2026-10-21) | After `updateUser({ password })`, the reset form now calls `signOut({ scope: 'others' })` (`src/components/auth/ResetPasswordForm.tsx`). There is no other password-change path. `SecureAccountForm` upgrades an anonymous session to a permanent one, so there are no other sessions to end. |
| 2.2.3 (3.3.4) | Non-revocable tokens expire within 24 hours | **Compliant** | The Supabase access JWT lifetime is the project default of 3600 s. Refresh tokens rotate with reuse detection and can be revoked. *Confirm under Supabase → Authentication → Sessions / JWT expiry.* |
| 2.3.1 (3.4.1) | Session cookies are `Secure` | **Compliant** (fixed 2026-10-21) | `@supabase/ssr` leaves `Secure` off by default. All three clients now pass `secure` (`src/lib/supabase/cookie-options.ts`, used by `server.ts`, `middleware.ts` and `client.ts`). The other app cookies (OAuth return state, referral, coach invite, NEN session, demo preview) also set `Secure` in production. Test: `src/test/casa-hardening.test.ts`. |
| 2.3.2 (3.4.2) | Session cookies are `HttpOnly` | **Gap** | The Supabase session cookie must be readable by the browser Supabase client, which runs sign-in, sign-up, reset and the auth callback in the page (`src/components/auth/*`). App-owned cookies are `HttpOnly`. Compensating controls: CSP, React output encoding, no third-party scripts beyond GA/GTM. Fix: move every auth step to server actions or route handlers and set `httpOnly: true` in `cookie-options.ts`. **Effort: 2 to 4 days** (8 portals share these flows). |
| 2.3.3 (3.5.2) | Session tokens, not static API secrets | **Compliant** | Users authenticate with Supabase JWT sessions. Static bearer secrets exist only for server-to-server cron and ATS calls and are checked fail-closed and timing-safe (`src/lib/auth/bearer-secret.ts`). |
| 2.3.4 (3.5.3) | Stateless tokens are signed and resist tampering | **Compliant** | The server never trusts a decoded JWT. It calls `supabase.auth.getUser()`, which validates with the Auth server (`src/lib/supabase/middleware.ts`, `src/lib/admin/auth.ts`). App-signed links use HMAC-SHA256 with a timing-safe compare (`src/lib/email/signed-links.ts`). Admin OAuth state is signed. |
| 2.4.1 (3.7.1) | Sensitive actions need re-auth or a secondary check | **Compliant** (fixed 2026-10-21) | The member's irreversible actions are "Delete my Google data" and "Deactivate my account". Each needs a typed confirmation word (`DELETE`, `DEACTIVATE`) and a recent authentication: the session's last real sign-in (JWT `amr` timestamp, anonymous excluded) within 10 minutes, or else a one-time code emailed to the account address. The code is a Supabase email OTP (admin `generateLink`), sent by us through Resend and verified with `verifyOtp` (single use, Supabase expiry, 5 codes an hour per member). Code: `src/lib/auth/reauth.ts`, `src/lib/auth/recent-auth.ts`, `src/app/dashboard/privacy/{actions,google-data-actions}.ts`. Events: `reauth_challenge_shown`, `reauth_challenge_passed`, `reauth_code_rejected`. Email change goes through Supabase's confirm-both-addresses flow. Test: `src/test/casa-tier2.test.ts`. |

## 3. Access control

| ID | Requirement | Status | Our answer and evidence |
|---|---|---|---|
| 3.1.1 (4.1.1) | Access rules enforced server-side | **Compliant** | All member data is read and written in server actions and route handlers through Prisma. The member is derived from the session (`getOrCreateCandidateProfile(user.id)`), never from client input. In the database, **RLS is enabled on all 445 public tables** (checked 2026-10-21). 389 have no policy at all, which means deny-all for the `anon` and `authenticated` API roles. The Gmail, Calendar, token and scam-alert tables have no policies, so they are unreachable through Supabase's public API. The admin portal is on its own host and cookie (`src/proxy.ts`, `src/lib/supabase/portal.ts`), and every admin page and action calls `requireAdmin()` (`src/lib/admin/auth.ts`). |
| 3.1.2 (4.1.2) | Users can't tamper with access-control attributes | **Compliant** | Role comes from the server-side allowlist (`ADMIN_EMAILS`) and DB rows (Recruiter/Coach/Employer linked by `userId`). A mass-assignment fix in the 2026-10 audit stopped client-supplied ids. Claim and reference actions derive the candidate from the session. |
| 3.1.3 (4.1.5) | Fails closed, including on exceptions | **Compliant** | `requireAdmin` redirects when there is no user or no allowlist match. Cron and ATS bearer auth rejects when the secret is unset. A strict OAuth state check aborts before the code exchange. The rate limiter fails open by design, and it is not an access control. |
| 3.1.4 (4.2.1) | No IDOR | **Compliant** | Code review on 2026-10-21 covered every exported server action in `src/app/{dashboard,onboarding,i,recruiters,support/coach,talent,employer}/**/actions.ts` that takes an id. Each one scopes by owner, for example `findFirst({ where: { id, candidateId: profile.id } })` or an explicit `thread.candidateId !== profile.id` check. Org portals scope by `orgId`. Spot checks: `find-my-job`, `network`, `messages`, `references`, `portfolio`, `employer/roster` → `src/lib/employer/outplacement-roster.ts`. Public id routes are signed (`/api/scam-alert/[id]/not-spam`, `/api/unsubscribe/*`) or expose only public data (`/api/credentials/[id]`, which hashes the recipient email). |
| 3.1.5 (4.2.2) | Anti-CSRF on authenticated features | **Compliant** | Next.js Server Actions reject requests whose `Origin` doesn't match `Host` (built in; no `allowedOrigins` override in `next.config.ts`). Session cookies are `SameSite=Lax`. OAuth uses a per-browser nonce cookie validated strictly (`src/lib/google/oauth-return-path.ts`). Email action links are GET-confirm then POST (`src/lib/http/confirm-page.ts`). Unauthenticated forms are rate-limited. |
| 3.1.6 (4.3.2) | No directory listing | **Compliant** | Vercel serves no directory indexes. `/_next/`, `/.git/config` and `/.env` return 404 (checked live 2026-10-21). Source maps return 403. |
| 3.2.1 (ADA) | OAuth uses Authorization Code only; no implicit or ROPC | **Compliant** | Google connect uses the server-side authorization code flow with a confidential client and `access_type=offline` (`src/lib/email-tracking/gmail-oauth.ts`, `src/lib/calendar-tracking/google-calendar-oauth.ts`). Supabase sign-in uses PKCE (the `@supabase/ssr` default). No implicit or password grants to Google. |
| 3.2.2 (ADA) | `redirect_uri` and `state` validated strictly | **Compliant** | Redirect URIs are fixed per client (packet section 2). `state` is a 128-bit nonce bound to an HttpOnly, Secure, SameSite=Lax, 10-minute cookie and compared on callback. A mismatch aborts before the code exchange (`consumeOAuthReturnStateStrict`). The post-connect return path is limited to `/dashboard*` and `/onboarding/google` (`isSafeReturnPath`). |
| 3.3.1 (4.3.1) | Admin interfaces use MFA | **Partial** (built 2026-10-21; Compliant once the flag is on) | Supabase TOTP MFA. With `ADMIN_MFA_REQUIRED=true`, `requireAdmin()` (every admin page, server action and admin API route) requires an `aal2` session and sends an `aal1` session to the two-step page, https://admin.launchyournextchapter.com/support/admin/mfa (enroll with a QR code, enter a code, add a backup authenticator). The same rule applies to NextChapter-admin powers in the college and workforce portals and `/systems` (`isNcAdmin`), with a step-up page at `/i/mfa`, and to unreleased report files. The flag is off by default so nobody is locked out on deploy. Recovery: a second enrolled authenticator, or remove the factor in the Supabase dashboard (break glass, Section 9). Code: `src/lib/admin/mfa.ts`, `src/lib/admin/auth.ts`, `src/app/support/admin/mfa/`. |

## 4. Communications and cryptography

| ID | Requirement | Status | Our answer and evidence |
|---|---|---|---|
| 4.1.1 (9.1.2) | TLS 1.2+ everywhere | **Compliant** | Vercel terminates TLS. TLS 1.1 is refused and TLS 1.2 and 1.3 are accepted (`openssl s_client` 2026-10-21). HSTS is `max-age=63072000; includeSubDomains` (`next.config.ts`). Outbound calls to Google, Supabase, Resend and Anthropic are all `https://`. |
| 4.1.2 (9.2.1) | Trusted certificates in and out | **Compliant** | Vercel-managed public certs. Node's default certificate verification is never disabled (no `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED` in `src`). |
| 4.1.3 | No weak cryptography | **Compliant** | Tokens use AES-256-GCM with a random 96-bit IV (`src/lib/security/token-crypto.ts`). Links use HMAC-SHA256. SHA-1 appears only as a non-security dedupe key (`src/lib/crm/p0-leads.ts`, `src/lib/coach/note-summary.ts`, `src/lib/likely-openings/news-signal.ts`). |
| 4.1.4 (6.2.1) | Crypto fails securely, with no padding oracle | **Compliant** | GCM is authenticated: a bad tag throws, and a token with no usable key throws instead of passing ciphertext through (`decryptToken`). |

## 5. Data validation and sanitization

| ID | Requirement | Status | Our answer and evidence |
|---|---|---|---|
| 5.1.1 (5.1.1) | HTTP parameter pollution | **Compliant** | `URLSearchParams.get`/`FormData.get` take a single value. No handler merges duplicate keys. |
| 5.1.2 (5.1.5) | Redirects only to allowlisted targets | **Compliant** (fixed 2026-10-21) | `next` and `returnTo` go through `safeNext` (`src/lib/auth/safe-next.ts`) or `isSafeReturnPath`. The referral link `/api/r/[code]?to=` and the org sign-out used `startsWith('/') && !startsWith('//')`, which let `/\evil.example` out (confirmed live: 307 to `https://evil.example/`). Both now use `safeNext`, with a regression test in `src/test/casa-hardening.test.ts`. The remaining redirects go to DB-stored, admin-set URLs (CRM outreach click, college give link). |
| 5.1.3 (5.2.4) | No `eval` or dynamic code | **Compliant** | No `eval`, no `child_process`. One `new Function` in `src/lib/jobs/board-snapshot-codec.ts` is built only from compile-time column constants, for speed, with no user input. A SAST tool will flag it; this is the explanation. |
| 5.1.4 (5.2.5) | Template injection | **Compliant** | React and React Email render all templates, with no server-side string template engines fed by user input. |
| 5.1.5 (5.2.6) | SSRF | **Compliant** | Fetches of user-supplied URLs (job postings, webhooks) go through `safeFetch`, which blocks private and loopback addresses with a DNS check (`src/lib/http/safe-fetch.ts`, used by `src/lib/jobs/fetch-job-posting.ts`). |
| 5.1.6 (5.3.10) | XML and XPath injection | **Compliant** | No XPath. XML and Office files are parsed with JS parsers that don't resolve external entities (`mammoth`, `unpdf`, the custom XLSX reader `src/lib/warn/xlsx.ts`, `cheerio`). |
| 5.1.7 (5.3.3) | XSS (output encoding) | **Compliant** | React escapes output by default. There are 7 `dangerouslySetInnerHTML` uses: admin-only mailing preview through `sanitizeBodyHtml`, admin markdown, a generated QR SVG, static report HTML and CSS bundled at build time, and JSON-LD. Defense in depth: an enforcing CSP with `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`. **Note:** `script-src` still needs `'unsafe-inline'` (next/script, JSON-LD). A nonce-based CSP is listed in Section 9 because a lab DAST will report it as a low or informational finding. |
| 5.1.8 (5.3.4) | SQL injection | **Compliant** | Prisma parameterises queries. The few `$queryRawUnsafe` calls pass values as `$n` parameters, and their interpolated identifiers are compile-time constants (`src/lib/job-reviews/data.ts`, `src/lib/geo/local-partners.ts`, `src/lib/funding-opportunities/store.ts`). |
| 5.1.9 (5.3.8) | OS command injection | **Compliant** | No `child_process` or shell calls in `src/`. |
| 5.1.10 (5.3.9) | File inclusion | **Compliant** | No filesystem paths built from request input. Static files are served by Vercel. |
| 5.2.1 (12.2.1) | Uploads limited by type; not executable | **Compliant** | `src/lib/uploads/validate-upload.ts` checks the leading bytes against an allowlist per use, and never accepts SVG. Files go to Supabase Storage, not the app filesystem, and are never executed. |

## 6. Configuration

| ID | Requirement | Status | Our answer and evidence |
|---|---|---|---|
| 6.1.1 | No components with known exploitable vulnerabilities | **Compliant** (fixed 2026-10-21) | `npm audit --omit=dev`: **0 vulnerabilities** (was 3 moderate: `mammoth` → `argparse@1` → `sprintf-js`, used only by mammoth's CLI; fixed with an npm `overrides` pin to `argparse@2`). The full tree has 9 high, all from one root (`braces` via `micromatch`/`fast-glob`) in dev-only tooling: `eslint-config-next` and the `shadcn` CLI, which moved to devDependencies. No upstream fix exists, and none of it is deployed. CI now runs `npm audit --omit=dev --audit-level=high` (`.github/workflows/ci.yml`). Next.js is 16.4.0. |
| 6.2.1 (14.3.2) | Debug off in production | **Compliant** | Production builds only. `poweredByHeader: false`. Generic 404 and error pages (checked live). Source maps not served (403). |
| 6.3.1 (14.5.2) | `Origin` not used for authn or authz | **Compliant** | No code reads `Origin` for access decisions. Next.js uses it only for the Server Action CSRF check. |
| 6.4.1 (10.3.3) | No subdomain takeover | **Compliant** | DNS is on Vercel (`vercel dns ls`, 2026-10-21). The apex and wildcard `ALIAS` point to our Vercel project. The only third-party CNAME is `links.updates` → Resend click tracking (active, valid HTTPS). |
| 6.5.1 (7.1.1) | No credentials in logs | **Compliant** (fixed 2026-10-21) | No `console.*` call logs tokens, passwords or keys (grep 2026-10-21). OAuth tokens are encrypted before storage. Gmail push no longer uses a URL secret (see 2.1.1), so none reaches Vercel request logs; the OIDC token travels in a header and is short-lived. |
| 6.6.1 (8.2.3) | Browser storage cleared on logout | **Compliant** (fixed 2026-10-21) | Every sign-out form in every portal is `SignOutForm` (`src/components/auth/SignOutForm.tsx`; a test fails if a plain one appears). On submit it resets PostHog's identity, expires PostHog's cookie, and empties `localStorage` and `sessionStorage` except an allowlist of three UI preferences with no member data (`src/lib/security/clear-browser-storage.ts`). The server-side sign-outs (deactivation, a deactivated profile) land on `/account-deactivated`, which does the same on load. Checked on a local dev server: interview answers, dismissed-job lists and a seeded PostHog id were gone; the menu preference stayed. |
| 6.7.1 (6.4.1) | Server secrets stored securely | **Compliant** | All secrets are in Vercel environment variables (encrypted at rest, team-scoped; none in git, and `.env*` is gitignored). Google refresh and access tokens are encrypted at the application layer with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), through a Prisma extension (`src/lib/security/token-crypto-extension.ts`). Production check 2026-10-21: 1 of 1 `EmailConnection` and 1 of 1 `CalendarConnection` tokens are encrypted, and none are left on disconnected rows. Recommended: mark `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET` as Vercel **Sensitive** variables. |

---

## 7. Items Google and labs ask about that are not one of the 48

| Topic | Status | Answer and evidence |
|---|---|---|
| Data minimization | **Compliant** | Gmail bodies are read in memory (capped at 4,000 chars) for classification and **never stored**. We keep the sender, recipient, subject, date, message and thread IDs, a has-resume flag, and our classification (`TrackedEmailActivity`). From Calendar we keep the title, time, duration and first other attendee (`TrackedCalendarEvent`). No Gmail content is sent to an AI model. Scopes are the minimum set: `openid`, `email`, `gmail.readonly`, `calendar.events.readonly` (packet section 1). |
| Deletion and retention | **Compliant** | Disconnect revokes the Google grant and blanks the stored tokens. **Delete my Google data** (Dashboard → Privacy, `src/app/dashboard/privacy/google-data-actions.ts` → `src/lib/google/delete-google-data.ts`) deletes the tracked email and calendar rows, Gmail-sourced scam alerts, and the connection rows straight away. Full account deletion goes by email to support. The privacy policy describes both (`src/app/privacy-policy/page.tsx`). |
| Encryption at rest | **Compliant** | Supabase Postgres and Storage are encrypted at rest (AES-256, provider-managed). Google tokens are also encrypted at the application layer (6.7.1). |
| Logging and monitoring | **Compliant** | Vercel runtime logs, CSP violation reports (`/api/csp-report`), admin record-view logging with a required reason (`AdminAccessLog`, `src/lib/admin/access-log.ts`), login events (`CandidateLoginEvent`), and Higher Ed audit (`src/lib/higher-ed/audit.ts`). |
| Dependency management | **Compliant** | Lockfile-pinned. CI typechecks, tests, lints and audits runtime deps on every push. Recommended: turn on GitHub Dependabot alerts in the repo's Settings → Code security. |
| Incident response | **Gap → draft below** | There was no written plan. The draft in Appendix A needs Justin's review. |
| Least privilege for staff | **Compliant** | One admin (Justin), on an allowlist. Admin Google scopes are on a separate OAuth client (`nextchapter-admin-511716`). |

---

## 8. Our own pre-lab scan (2026-10-21)

All checks ran against our own production domain only, unauthenticated, one request at a time.

- **Security headers** (`curl -sD -` on `/`, `/privacy-policy`, `candidate.` and 404 pages): present on every response.
  - CSP is enforcing, with a report-uri.
  - `Strict-Transport-Security: max-age=63072000`. This becomes `; includeSubDomains` after this deploy.
  - `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`.
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
  - No `X-Powered-By`.
- **Cookies:** public pages set no cookies. Session cookies come from Supabase and lacked `Secure` (fixed). The OAuth state cookie is `HttpOnly; Secure; SameSite=Lax`.
- **TLS:** TLS 1.1 refused; TLS 1.2 and 1.3 OK.
- **Exposure probes:** `/.env`, `/.git/config`, `/_next/`, `/api/does-not-exist` all return 404 with no stack traces. JS source maps return 403.
- **Open redirect:** `/api/r/<any>?to=/%5Cevil.example` returned **307 → https://evil.example/** (fixed). `/auth/login?next=//evil.example` is safe.
- **npm audit:** see 6.1.1.
- **OWASP ZAP baseline:** **not run.** Neither Docker nor ZAP is installed on this Mac. To run it: `brew install --cask zap`, or Docker Desktop with
  `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://launchyournextchapter.com -m 2 -z "-config connection.timeoutInSecs=30"`.
  That is a passive spider of about 2 minutes. Do it after this deploy so the header fixes are live.
- **Code review:**
  - Auth routes: `safeNext` and `isSafeReturnPath` hold; the two weak checks are fixed.
  - CSRF: covered by the built-in Server Action origin check plus the OAuth nonce.
  - IDOR: covered by the server-action sweep (3.1.4).
- **Supabase security advisor:**
  - `auth_leaked_password_protection` (WARN): see 1.1.1.
  - `auth_allow_anonymous_sign_ins` (WARN on 21 tables): reviewed 2026-10-21, no change needed. Anonymous sign-ins are on (Auth settings; 11 anonymous users, 1 in the last 30 days), used for onboarding, and anonymous users do get the `authenticated` role. But each of the 21 tables (and 35 more higher-ed tables) also has a **RESTRICTIVE** `he_no_anonymous` policy, `NOT coalesce((auth.jwt()->>'is_anonymous')::boolean, false)`, for all commands. Restrictive policies are ANDed, so an anonymous JWT gets nothing even before the `he_select` scoping (`he_is_staff`, `he_is_my_member`, `he_is_nc_admin`, all keyed on `auth.uid()`). The linter flags it only because it checks the permissive policy text. The app itself reads these tables through Prisma on the server, not the Data API.
  - `function_search_path_mutable` on `private.employer_outcomes_by_bucket`: **fixed** 2026-10-21 (`search_path = ''`, `prisma/manual/2026-10-21-function-search-path.sql`).
  - No tables have RLS disabled.

## 9. Remaining work for Justin, with effort

| # | Item | Control | Effort | Risk if skipped |
|---|---|---|---|---|
| 1 | Supabase: set minimum password length to 8, turn on leaked-password protection (Pro), and confirm OTP expiry ≤ 1 h and JWT expiry 3600 s | 1.1.1, 1.3.1, 2.2.3 | 15 min (dashboard) | Lab marks 1.1.1 failed |
| 2 | Admin MFA: built. Justin enrolls at https://admin.launchyournextchapter.com/support/admin/mfa (plus a backup authenticator), then `ADMIN_MFA_REQUIRED=true` in Vercel and redeploy | 3.3.1 | 10 min | Certain fail at AL2 until the flag is on |
| 3 | HttpOnly session cookies (server-side auth flows). **Deferred.** | 2.3.2 | 2 to 4 days | Likely flagged by Burp |
| 4 | ~~Re-auth before Delete my Google data and deactivation~~ Done 2026-10-21 | 2.4.1 | — | — |
| 5 | Gmail push: code done (OIDC). If push is ever turned on, use the OIDC subscription steps; never the `?token=` URL | 2.1.1, 6.5.1 | 20 min when wanted | — |
| 6 | ~~Clear browser storage on logout~~ Done 2026-10-21 | 6.6.1 | — | — |
| 7 | **Deferred.** Nonce-based CSP (drop `'unsafe-inline'` from `script-src`). Start as `Content-Security-Policy-Report-Only` with nonces from `src/proxy.ts`; this forces dynamic rendering, so measure the performance cost first | 5.1.7 (defense in depth) | 1 to 2 days plus a soak | Low/informational DAST finding |
| 8 | Run the ZAP baseline (Section 8) and attach the report | readiness | 30 min | — |
| 9 | Sign off the incident response plan (Appendix A) | program | 30 min | Labs ask |
| 10 | Mark key secrets as Vercel "Sensitive", and keep an offline backup of `TOKEN_ENCRYPTION_KEY` | 6.7.1 | 15 min | — |
| 11 | Turn on GitHub Dependabot alerts | dependency mgmt | 5 min | — |
| 12 | ~~`function_search_path_mutable` advisor warning~~ Done 2026-10-21 | hardening | — | — |

**Admin MFA break glass (lost phone, no backup):** sign in to https://supabase.com/dashboard/project/uvoulytrsrxasqzutlmq/auth/users, open the admin's user, and delete the MFA factor (or set `ADMIN_MFA_REQUIRED=false` in Vercel and redeploy). Then sign in at https://admin.launchyournextchapter.com/support/admin/login and enroll a new authenticator. Only someone with Supabase dashboard access can do this, which is the point.

---

## Appendix A: Incident response plan (draft for Justin to approve)

1. **Roles.** Incident lead: Justin Kulla (justin@launchyournextchapter.com). There is no separate on-call yet.
2. **Detect.** Sources: Vercel logs and alerts, CSP reports, the Supabase security advisor, user reports to
   support@launchyournextchapter.com, Google Trust & Safety emails, and dependency alerts.
3. **Contain within 24 h** of a confirmed incident involving Google user data:
   - revoke affected Google grants (disconnect flow or admin script);
   - rotate the exposed secrets in Vercel (`TOKEN_ENCRYPTION_KEY` rotation: set `TOKEN_ENCRYPTION_KEY_PREVIOUS`, then run
     `scripts/encrypt-oauth-tokens.ts --apply --reencrypt`), the Supabase service key, and OAuth client secrets;
   - roll back the deploy in Vercel if code is the cause.
4. **Assess.** Use logs to establish which members, which data and what time window are affected.
5. **Notify.**
   - Affected users without undue delay, and within 72 hours where law requires it.
   - Google, if Google user data was involved: contact through the Cloud Console project's Trust & Safety thread, as the API Services User Data Policy requires.
   - State regulators as required.
6. **Recover and review.** Fix the root cause, add a test, and write up the incident within 7 days. Review this plan every year with the CASA renewal.

## Appendix B: Lab test account (do NOT create in production until Justin approves)

Goal: one member account the lab can log into, with realistic **fake** data, that touches nothing real.

1. **When the lab asks**, Justin creates the user himself. Supabase dashboard → Authentication → Users → Add user:
   - email `casa-lab@nextchapter.test`, or an inbox the lab gives us;
   - a generated 20+ character password, sent to the lab through their portal only, never by email;
   - Auto Confirm on.

   The `@nextchapter.test` domain matches the existing fixture convention, so cleanup scripts can find it.
2. **Seed fake data** with the existing fixture tooling:
   - Base it on one profile from `scripts/seed-test-candidates.ts`: function, level, city, grade history, weekly activity.
   - Add a few `JobPosting` rows (applied, interview), 3 `TrackedEmailActivity` rows (application confirmation, rejection, interview invite) and 1 `TrackedCalendarEvent`. The lab can then see the Gmail-derived screens without a real mailbox.
   - Use example.com companies and senders only.
3. **Gmail scope testing.** If the lab must exercise the real Google connect flow, they use **their own** Google test account. Add it to
   `GMAIL_TRACKING_TESTER_EMAILS`, or set `gmailTrackingTesterEnabled` on the lab profile, so it passes the tester gate. Never use a NextChapter staff mailbox.
4. **Limits:**
   - Don't add the account to `ADMIN_EMAILS`. The lab tests the member app; admin is out of scope unless Google says otherwise.
   - A `.test` address can never receive mail, and `isUndeliverableAddress` (`src/lib/email/resend-client.ts`) already skips sends to it. If the lab gives a real inbox instead, turn off the profile's email topics first.
   - Check that census and metrics exclude it (filter on the email domain) before any report runs.
5. **Afterwards:**
   - run Delete my Google data on the account;
   - delete its `CandidateProfile` and then the auth user;
   - revoke any Google grant the lab connected;
   - remove the tester allowlist entry.
