# Employer portal as separately claimable sections

Decided 2026-10-23. Status: not built. This is the shape to build toward, written from an audit of the code on 2026-10-23.

## The decision

One employer organization with separate sections. Each section can be claimed by a different person, paid for separately, or bought together as an enterprise package.

| Section | What it is | Today |
|---|---|---|
| Outplacement | Seats for laid-off employees, roster, scorecard, invoices. Contract: per seat per month on a 6, 12 or 24 month term. | Built: `/employer`, `OutplacementEmployerOrg`, `OutplacementContract` (tiers CORE, PLUS, PREMIUM). |
| Retention | Promotion and raise prep, internal roles, pivots, team reporting. | Built as the GROWTH contract type: `/employer/growth`. |
| Learning and development | Own courses, AI skills gap view. | Built as the LEARNING contract type: `/employer/learning`. |
| Job retraining | Retraining for people whose jobs are changing. | Not built. Label declared only. |
| Hiring | Roles, candidate inbox, scorecards, analytics. | Built, separately: `/talent`, `EmployerProfile`, `EmployerSeat`. Not linked to the above. |

## What exists that this builds on

- `Organization` and `OrgWorkspace` (one per organization and type: HIGHER_ED, OUTPLACEMENT, WORKFORCE, COACH, HIRING, RECRUITER; `refId` points at the portal's own record). Today the workspace only carries a shared brand and integration flags.
- Portal labels: `src/lib/partners/portal-types.ts` already names the five sections.
- Roles inside outplacement: ADMIN, VIEWER, LEGAL, FINANCE. Hiring: OWNER, MEMBER only.
- Hiring workspaces are claimed by email match (`claimHiringWorkspace`).

## What has to change

1. **One employer organization, several workspaces.** Add the types RETENTION, LEARNING and RETRAINING to `OrgWorkspace`, and link the hiring workspace to the same organization as outplacement. Today the outplacement login and the hiring login are different systems. Decide whether a person signs in once and sees the sections they hold, which is the intent.
2. **Section ownership.** Each workspace has its own admins. A person can hold different roles in different sections (for example HR operations owns Retention, talent acquisition owns Hiring).
3. **Plans per section, with an enterprise override.** Each workspace has its own plan; an organization-level enterprise plan covers all of them. Outplacement stays contract-based and sales-led.
4. **Claim per section.** A verified work email at the organization's domain claims a section; see the verified-claim work on `/prepared/[slug]`.
5. **Billing users.** A billing role per organization that can see invoices and plans across sections, and can also be an admin. Billing itself is deferred (see IDEAS.md).

## Open questions for the owner

- Single sign-on across sections, or one login per section?
- Does Retention need its own contract type, or stay as GROWTH inside the outplacement contract?
- What does an enterprise package include, and is it priced per employee or flat?
