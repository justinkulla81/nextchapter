# Plans and pricing structure

Suggested 2026-10-23, for the owner to decide. Status: not built. No payment code exists yet; plans are set by NextChapter staff today. Prices below are placeholders unless marked as already published.

## Principles

1. Individuals are never charged for the basics. Candidates are the product and the reason everyone else buys.
2. Free is a real start, not a trial: a verified organization gets a free workspace (50 active members, its own page, its own services listed, basic counts).
3. Paid buys what an administrator needs at scale: reporting, exports, more members, staff roles, audit log, single sign-on, workforce reporting.
4. Anything that costs us money per use (human coaching sessions, AI-heavy services) is priced per use or capped, never bundled as unlimited.
5. Each portal may bill differently. Do not force one pricing model on all of them.
6. Existing institutions keep everything they have today.

## The three plan families

| Family | Who | Free | Paid |
|---|---|---|---|
| Individual | A candidate or a partner | Core search tools, move plan, partner invite, Candidate+ earned through effort | Optional membership (exists: `MembershipSubscription`); coaching sessions as add-ons |
| Organization | Higher education, workforce boards, chambers, nonprofits | Verified claim: page, 50 active members, own services, basic counts | One annual price by size band (alumni or participant count), so budgets are predictable; unlocks reporting, exports, CRM exchange, more members, staff roles, audit log, SSO, workforce reporting |
| Corporate | Employers, by lifecycle section | Hiring: post a role free (matches the current marketing) | Each section bought on its own, or an enterprise bundle |

## Corporate sections (employee lifecycle)

| Section | Employees | Pricing shape |
|---|---|---|
| Hiring | Future | Monthly subscription by tier for the hiring team (the schema already holds CHARTER, STANDARD, PRO with about $200 and $500 to 600 a month noted in comments; owner to confirm) |
| Grow and keep (learning and development, retention, job retraining) | Current | Annual, by headcount band, with the services chosen inside it |
| Outplacement | Departing | Per seat per month for a 6, 12 or 24 month term. Already published: CORE $895, PLUS $2,450, PREMIUM $7,450 per seat, volume discounts 10% at 25 seats, 18% at 100, 25% at 250 (docs/specs/NextChapter_Partners_Master_Build_Script.md section 2.2, /pricing). Keep contract-based and sales-led |
| Enterprise bundle | All three | One contract, one invoice, one sign-in; a bundle discount. Suggest starting at 10 to 15% off the sum, owner to set |

Different people can claim different sections (HR operations claims Grow and keep, talent acquisition claims Hiring). Each section has its own plan and its own admins. A billing user can see invoices and plans across sections and can also be an admin.

## Add-ons (any family)

- Coaching sessions, by pack or per session (human cost).
- AI course packs and NextChapter's courses for an organization's members.
- Members beyond the plan's cap.
- Workforce federal reporting (WIOA) and outcomes board reports.
- Single sign-on, API and CRM exchange, priority support.

## What this does not decide

Prices for Organization size bands, the Grow and keep bands, the bundle discount, and whether recruiters and coaches ever pay (B2B2C: free for now). Payment collection (a card or invoice flow) is deferred; see IDEAS.md.

Decided 2026-10-23: the website shows plans, not prices.
