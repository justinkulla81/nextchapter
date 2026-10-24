# Employer sections: build plan

Written 2026-10-24 from a read of the auth code for both portals. Status: Part A of this plan is design only. The additive data and the pure library (see "What is already built") are in the repository; no login, middleware, invite or route behaviour has changed.

Builds on `docs/specs/employer-sections.md` (the decision) and `docs/specs/plans-and-pricing-structure.md` (plans, not prices; no prices in any UI copy).

## Owner decisions this plan builds on (2026-10-24)

- One employer organization, **three claimable, separately paid sections** by employee lifecycle: **Hiring** (future employees), **Employees** (current employees: learning and development, retention, job retraining are services inside it), **Outplacement** (departing employees).
- A person signs in once and sees only the sections they hold. Different people can claim different sections. An enterprise package covers all three. Billing is deferred, a billing role comes later.
- The top bar shows the specific service: `Employer · Employees · Learning and development`, `Employer · Hiring`, `Employer · Outplacement`.

## 1. What exists today (from the audit)

| Thing | Outplacement (and Growth, Learning) | Hiring |
|---|---|---|
| Customer record | `OutplacementEmployerOrg` | `EmployerProfile` (one per signed-up person, unique `userId`) |
| People and roles | `OutplacementOrgUser`: ADMIN, VIEWER, LEGAL, FINANCE; unique `userId`, so one org per person | Owner is `EmployerProfile.userId`; teammates are `EmployerSeat` (OWNER, MEMBER) |
| Auth resolver | `getCurrentOutplacementOrgUser` / `requireOutplacementRole` (27 files) | `resolveEmployerForUserId` (11 files) |
| Session cookie | `sb-employer-auth-token`, client `createClient('employer')` | `sb-talent-auth-token`, client `createClient('talent')` (34 files) |
| Routes | `src/app/employer/(app)/*`; Growth under `/employer/growth` (contract type GROWTH), Learning under `/employer/learning` (LEARNING) | `src/app/talent/(app)/*` |
| How someone gets in | No self-serve. Staff set up a contract, then invite the first ADMIN; invite accept at `/employer/invite/accept/[token]` | Self-serve signup at `/talent/signup`; teammates via `/talent/seats/accept/[token]`; `claimHiringWorkspace` joins a pending `OrgWorkspace` by invited email |
| Pricing | Contract per seat per month (`OutplacementContract`, tiers CORE, PLUS, PREMIUM) | `EmployerProfile.subscriptionTier` (CHARTER, STANDARD, PRO), Stripe ids |

Facts that shape the design:

1. **Both logins are the same Supabase project.** `NEXT_PUBLIC_SUPABASE_URL` is shared; only the cookie name differs (`src/lib/supabase/portal.ts`). So one person with one email is already one `auth.users` row. What is split is the browser session, not the identity. Single sign-in is a session problem, not an identity-merge problem.
2. **The employer host already exists.** `employer.<site>` (`src/lib/portal-hosts.ts`) serves `/hiring` (talent cookie), `/growth`, `/learning` and `/outplacement` (employer cookie), with a landing page at `/employer-home`. Cookies are host-only, so on that host both cookies are already in one jar. The host is switched on per portal by `NEXT_PUBLIC_PORTAL_SUBDOMAINS`; with it off, everything is a path on the main site.
3. **Middleware refreshes one cookie per request**, chosen by path (`portalForPath` / the mount's `cookie`). A session in a cookie the request's path does not map to is never refreshed there.
4. **`Organization` / `OrgWorkspace` only carry brand and integration flags** today. One workspace per organization and type (`@@unique([orgId, type])`), `refId` points at the portal record, `status` is a string (ACTIVE, PENDING, SUSPENDED). `OrgWorkspaceType` is a real Postgres enum, so a new type is an additive `ALTER TYPE ... ADD VALUE`.
5. `OutplacementOrgUser`, `EmployerProfile` and `EmployerSeat` each have `userId @unique`: a person is in at most one outplacement org and one hiring account today.
6. `RoleGrant` (global ledger) feeds the role banner and `switchRole`; employer roles map to `/employer/login` only.

## 2. Target data model

```
Organization  (one per employer; linked to CrmOrganization; domain = work email domain)
  enterprise, enterpriseSince                      (new)  covers every section
  └── OrgWorkspace  type HIRING | EMPLOYEES | OUTPLACEMENT   (one per section, existing uniqueness)
        refId       the section's own record (see below)
        status      ACTIVE | PENDING | SUSPENDED          (existing)
        plan        FREE | PAID | CONTRACT | ENTERPRISE   (new, default FREE)
        planSource, planUpdatedAt, planNote               (new) STAFF today, STRIPE later
        services    JSON, switches inside the section     (new)
        └── OrgWorkspaceAdmin  email, userId, role ADMIN | VIEWER | BILLING, source   (new)
```

Applied by `prisma/manual/2026-10-24-employer-sections.sql` (additive; the owner's assistant applies it). Nothing reads these yet.

**How each section points at today's systems (no records move):**

| Workspace | `refId` | Notes |
|---|---|---|
| OUTPLACEMENT | `OutplacementEmployerOrg.id` | Unchanged. Plan is CONTRACT (sales-led). |
| EMPLOYEES | the same `OutplacementEmployerOrg.id` | No new customer table. The record that holds the GROWTH and LEARNING contracts is already the Employees customer. |
| HIRING | `EmployerProfile.id` of the owner | Existing; `claimHiringWorkspace` already writes it. |

**GROWTH and LEARNING (recommendation: one Employees workspace with services, no contract-type migration now).**

- Keep `OutplacementProgramType` and the existing contracts exactly as they are. Do not rename or delete GROWTH or LEARNING.
- Backfill one EMPLOYEES workspace for each organization that has a GROWTH or LEARNING contract, and set `services` from the contracts: GROWTH on means `retention: true`, LEARNING on means `learning: true`; `retraining: false` (not built).
- The buyer then chooses services inside Employees. Staff turn services on in `services`; the contract rows stay the billing record until billing is built. Later, an additive contract value (for example EMPLOYEES) can replace the two, only after nothing reads GROWTH and LEARNING.
- `/employer/growth` and `/employer/learning` keep working at the same URLs. The nav links already depend on contracts (`EmployerNav.buildLinks`); they keep doing so until the resolver below can answer from `services`.

**Known wrinkle:** hiring is per signed-up person, not per company. Several people at one company can each have their own `EmployerProfile` with their own subscription. The organization's HIRING workspace points at one of them (the claiming owner). The others stay separate until a decision on merging them (decision 7).

## 3. Single sign-in design

Goal: sign in once, see only the sections you hold, never get locked out.

### 3.1 Step 1 (no cookie change): one access resolver

A new read-only function, `getEmployerAccess(userId, email)`, returns the sections a person holds and their role in each, as the union of:

- Hiring: `EmployerProfile.userId` or an accepted `EmployerSeat` (today's `resolveEmployerForUserId`).
- Outplacement and Employees: `OutplacementOrgUser` (outplacement always; Employees for each contract the org has), exactly as today.
- New: `OrgWorkspaceAdmin` rows for that user.

The old checks stay the source of truth for existing people. The new table only adds access, never removes it. This feeds a section switcher, the employer host landing page and the top bar. Risk: none for logins (read only). Test: for every existing user the resolver returns at least what today's checks return (a diff script over production data, run read-only before use).

### 3.2 Step 2: getting the session across sections

Three options. Recommendation: **A first, optionally B later.**

**A. Bridge by sign-in link (recommended).** The person is signed in to one section (one cookie). A "Switch to Hiring" action calls a server route that checks (a) the current session user, (b) that `getEmployerAccess` says they hold the target section, (c) that the target section's login would accept this user (same `auth.users` row, same email), then mints a one-time link with `supabase.auth.admin.generateLink` (magic link, to the same verified email) that lands in the other cookie. The invite flows already do this (`createPreConfirmedInviteUser`, `callbackOriginForAppPath`), so the pattern and the callback origins exist.
- Changes no cookie name, no middleware, no existing login. Existing sessions are untouched.
- Each section keeps its own session with its own refresh token, so nothing is shared that can be invalidated.
- Risks: the link must go to a fixed, allow-listed destination (no open redirect via `next`); minted only for the signed-in user's own email; short-lived and single use; the route must be a POST with CSRF protection; log each use (PostHog event). It only works when the person used the same email in both portals; otherwise the person needs a one-time "link my other account" step (decision 6).

**B. One employer cookie (cleanest, riskiest).** Make `/talent` use the `employer` cookie so all three sections share one session: change `PORTAL_PATH_PREFIXES` (`/talent` to `employer`) and the `/hiring` mount's `cookie` in `portal-hosts.ts`; login writes only the new cookie.
- Every existing hiring session is in `sb-talent-auth-token`; the day this ships all of them look signed out.
- Safe version: a dual-read window. For `/talent` paths the proxy reads the employer cookie first, then the legacy talent cookie; if only the legacy one exists it **moves** it (writes the same value under the new name and expires the old name in the same response; never copies, never leaves both). Two parallel requests could both move it, and Supabase can treat a re-used refresh token as theft and end the session, so this must be a single place with a grace period and a fallback of "ask to sign in again", never an error page.
- Also touches 34 files that call `createClient('talent')`, `PORTAL_APP_SUBROUTES`, `redirectIfAuthenticated`, the callback handler, forgot-password and email redirect targets.

**C. Share one cookie across all three from day one:** not recommended; same risks as B with no staging.

### 3.3 Exact auth changes by step, and what each can break

| # | Change | Files | What could lock existing customers out | How to avoid it |
|---|---|---|---|---|
| 1 | Add `getEmployerAccess` (read only) | new `src/lib/employer/access.ts` | Nothing; not called by any login path | Diff script against today's checks before wiring any page to it |
| 2 | Add the section chooser at `/employer-home` and the top bar trail | `EmployerNav`, `TalentNav`, `PartnerTopBar` | A wrong chooser sending people to a page they cannot open | Chooser only links to sections the resolver says they hold; old links keep working |
| 3 | Bridge route (A) | new route under `src/app/employer/` | A broken link strands someone in the wrong section | Never replaces the section's own login; the old login path always works |
| 4 | `getCurrentOutplacementOrgUser` falls back to `OrgWorkspaceAdmin` when no `OutplacementOrgUser` row exists | `outplacement-auth.ts` | If the order is reversed (new table first) everyone without a row loses access | Legacy lookup first, new table only as a fallback; never remove the legacy lookup in the same change |
| 5 | Replace `redirect('/employer/signup')` for a signed-in person with no outplacement row | `outplacement-auth.ts` | A hiring-only person landing on `/employer` is told "accounts are set up with your contract" and thinks they are locked out | Send them to the chooser (their own section) instead; keep the explainer for people who hold nothing |
| 6 | Per-section role gate: `requireSectionRole(section, roles)` over the resolver | pages under `/employer/(app)` | Gating Employees pages on a new row would hide `/employer/growth` and `/employer/learning` from today's users | Employees access = today's `OutplacementOrgUser` role on an org with that contract, until backfill is verified |
| 7 | Add RoleGrant values for the new roles and map them in `switch-role.ts` | `schema.prisma` enum (additive), `switch-role.ts` | Missing map entries hide the banner link | Additive enum values; unmapped roles are already filtered out |
| 8 | Domain claim per section (section 5) | new, under `src/lib/org-claims` | A claim silently making a stranger ADMIN of an already claimed section | First verified claimant on an unclaimed section only; later claimants become a request to the existing admins |
| 9 | (Option B only) one employer cookie with dual-read | `portal.ts`, `portal-hosts.ts`, `proxy.ts`, `middleware.ts`, `LoginForm`, callbacks, 34 files | Every hiring user appears signed out; refresh tokens invalidated by double use; unrefreshed legacy cookie expires within the token lifetime | Dual-read plus move, single writer, feature flag, ship outside business hours, keep password login unchanged |

**What could lock existing customers out, as one list:** renaming or remapping a session cookie; middleware refreshing the wrong cookie; making the new table the first or only authority; the `redirect('/employer/signup')` dead end for a person who signs in but holds nothing in that section; `userId @unique` (a person already in one outplacement org cannot be added to another with the same account); a hiring signup with an email that already exists in another portal getting an "already registered" response and looking like a failed account (route them to log in instead); portal hosts switched on or off changing which cookie jar a link lands in (emailed links must keep using `callbackOriginForAppPath`); an auto-claim by email domain overriding an existing admin.

## 4. Migration steps, in a safe order

Each step is shippable on its own and leaves every current login working.

1. **Apply the additive SQL** (`2026-10-24-employer-sections.sql`) and ship the models. Safe before or after the deploy; nothing reads them. (Done in this branch; the owner's assistant applies the SQL.)
2. **Read-only audit on production** (no writes): count people who hold both a hiring account and an outplacement login with the same email; organizations with several `EmployerProfile` rows; contracts by program type; `OutplacementOrgUser` rows without an accepted invite. This sizes decisions 6 and 7.
3. **Backfill workspaces** (additive writes, by script, idempotent): for each `OutplacementEmployerOrg` that has an `Organization`, ensure OUTPLACEMENT and (if it has GROWTH or LEARNING contracts) EMPLOYEES workspaces with `services` set from contracts; organizations without an `Organization` row get one created from the existing contact and domain (reviewed list first). Hiring workspaces already exist where `claimHiringWorkspace` ran. Set `plan` from today's facts (CONTRACT for outplacement; `FREE` otherwise).
4. **Backfill `OrgWorkspaceAdmin`** from `OutplacementOrgUser` (role mapped ADMIN to ADMIN, VIEWER, LEGAL and FINANCE to VIEWER or a section-specific role, see section 6) and `EmployerProfile` / `EmployerSeat` (OWNER to ADMIN, MEMBER to VIEWER), with `source = MIGRATED`. Nothing reads them yet.
5. **Ship `getEmployerAccess`** and the diff report: for every user, resolver result is a superset of today's access. Fix any difference before continuing.
6. **Ship the chooser, top bar trail and section switcher** (read only, links only to held sections).
7. **Ship the bridge (option A)**: single sign-in experience with no cookie change. Watch the PostHog event `employer_section_switched` for failures.
8. **Ship per-section claim** (section 5), then per-section roles (section 6), reading the new tables as a fallback after the legacy checks.
9. **Staff set plans** per workspace and the enterprise flag from an admin screen (no payment code). Billing role and payment collection follow later.
10. **Optional, later, only if wanted: option B** (one cookie) behind a flag, with the dual-read move; then retire the legacy cookie after a quiet period.
11. **Optional, much later:** collapse GROWTH and LEARNING into one contract value after nothing reads them.

## 5. Per-section claim flow

Reuse `src/lib/org-claims` (`requestOrgClaim`, `confirmOrgClaim`, `checkClaimEmail`, the `/prepared/[slug]` pages, hashed single-use token, rate limits, the `onClaimVerified` hook that is documented as the place to provision a free workspace).

1. On `/prepared/<slug>` the visitor picks the section to claim (Hiring, Employees or Outplacement). Add a `section` column to `OrgClaim` (additive) and pass it through `requestOrgClaim`, the email and the verify route.
2. They enter name, title and work email. `checkClaimEmail` already refuses personal providers and addresses off the organization's known domain (`CrmOrganization.emailDomain`, mirrored by `Organization.domain`). With no known domain the claim is `needsReview`.
3. They open the emailed link. `confirmOrgClaim` verifies it once. In `onClaimVerified`, **in addition to** the CRM lead it creates today: ensure the `Organization` (linked to the `CrmOrganization`) and the section's `OrgWorkspace` (status ACTIVE, plan FREE, or PENDING if `needsReview`), and an `OrgWorkspaceAdmin` ADMIN row for the verified email with `source = DOMAIN_CLAIM`.
4. First verified claimant of an **unclaimed** section becomes its admin. If the section already has an admin, the new person gets a **request** sent to the existing admins (and staff), never admin by domain alone. Outplacement stays sales-led: a verified claim creates the workspace record and a CRM lead for staff, and gives no seats or contract until staff set them up.
5. The new admin signs in once with that same email (signup or login for that section) and `getEmployerAccess` links them by email and `userId`.
6. Events: `employer_section_claim_requested`, `employer_section_claim_verified`, `employer_section_claim_blocked_existing_admin`, with `{ orgId, section, claimId, emailDomain }`.

## 6. Per-section roles

| Section | Roles | Today |
|---|---|---|
| Hiring | ADMIN (owner), VIEWER (member), BILLING | OWNER and MEMBER only |
| Employees | ADMIN, VIEWER, BILLING | Uses the outplacement ADMIN and VIEWER (Growth and Learning nav shows for ADMIN and VIEWER) |
| Outplacement | ADMIN, VIEWER, LEGAL, FINANCE | Unchanged: the four existing roles |

- `OrgWorkspaceAdmin.role` is a string, so section-specific roles are additive. Outplacement keeps its four roles exactly; LEGAL and FINANCE only exist there.
- BILLING is per section here. An organization-level billing role that sees invoices across sections (and can also be an admin) is deferred with billing; the table can add an org-level role then without changing these rows.
- A person can hold different roles in different sections (HR operations ADMIN of Employees, talent acquisition ADMIN of Hiring, finance BILLING everywhere).
- The last-admin protections that exist for outplacement (`removeOrgUser`: never yourself, never the last active admin) must apply to every section.
- Enterprise: `Organization.enterprise` unlocks all three sections for people already holding a role; it does not grant roles.

## 7. What is already built (Part B, no behaviour change)

- `prisma/manual/2026-10-24-employer-sections.sql` and matching Prisma models: enum value `EMPLOYEES`; `OrgWorkspace.plan / planSource / planUpdatedAt / planNote / services`; `Organization.enterprise / enterpriseSince`; table `OrgWorkspaceAdmin`.
- `src/lib/employer/sections.ts`: the three sections, their services, which existing routes belong to each, and path and workspace lookups. Tests in `src/test/employer-sections.test.tsx`.
- `src/lib/partners/portal-types.ts`: `portalTypeLabel` now returns `Employer · Employees · Learning and development`, `Employer · Employees · Retention`, `Employer · Employees · Job retraining`. `Employer · Outplacement` and `Employer · Hiring` are unchanged; the five existing `uses` labels and `employerUseForPath` are unchanged.
- `src/components/marketing/EmployerOverview.tsx`: read-only list of the three sections and their services for marketing pages. No links, no login logic, no prices.

## 8. Estimate (steps, one engineer, with review)

| Step | Size |
|---|---|
| 1 SQL and models | done |
| 2 Production audit script | S (half a day) |
| 3 Workspace backfill script and dry run | M (1 to 2 days) |
| 4 Admin backfill | S (half a day) |
| 5 `getEmployerAccess` plus diff report | M (2 days) |
| 6 Chooser, top bar trail, section switcher | M (2 days) |
| 7 Bridge sign-in (option A) | M (2 to 3 days) |
| 8 Per-section claim (`OrgClaim.section`, hook, request flow, emails) | L (4 to 5 days) |
| 8 Per-section roles, nav and gates | L (3 to 4 days) |
| 9 Staff screen for plan and enterprise | S to M (1 to 2 days) |
| 10 Option B (one cookie, dual-read) | L (5 to 7 days, plus a quiet-period) |

Core (steps 2 to 8) is about 3 to 4 weeks. Option B and billing are separate.

## 9. Decisions the owner must make

1. **Single sign-in method:** bridge by sign-in link (recommended, no existing session changes) or one employer cookie (cleaner, forces a careful migration of every hiring session). This plan assumes the bridge first.
2. **Employees as one workspace with services** (recommended) versus keeping GROWTH and LEARNING as separate sections. And whether retiring the two contract types is ever wanted.
3. **Who becomes admin on a claim:** confirm "first verified claimant of an unclaimed section; later claimants need an existing admin's approval". And whether a claim without a known organization domain is allowed at all (today it goes to staff review).
4. **Outplacement claim:** a claim creates a record and a staff lead only, never seats (recommended), or may it give a self-serve start.
5. **Roles:** confirm Hiring gets ADMIN, VIEWER and BILLING (replacing OWNER and MEMBER in name only), and whether Employees needs its own roles beyond ADMIN, VIEWER and BILLING.
6. **People with different emails in different portals:** allow a one-time "link my other account" step (proof by email at both addresses), or require the same work email everywhere.
7. **Several hiring accounts at one company:** merge them into one organization hiring workspace (and what happens to each one's subscription), or keep them separate and attach only the first.
8. **One person in several organizations** (consultants, board members): `userId @unique` blocks this today. Allow it (a larger change) or not.
9. **Enterprise:** what the package includes beyond unlocking all three sections, and who can turn it on (staff only, as assumed).
10. **Billing role scope:** per section now, or one organization-wide billing role from the start (affects the table).
11. **Employer host:** switch `employer.<site>` on for all employer traffic so the chooser and bridge live on one host (recommended), or stay on main-site paths.
12. **Top bar wording:** `Employer · Employees · Learning and development` is live in this branch; confirm that is the wording wanted for Retention and Job retraining too.
