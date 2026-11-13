# Recruiter pilot plan (500 recruiters)

Status: plan only, 2026-11-13. No email goes out and nothing is built until the owner picks from the decisions at the end.

## The pitch

A free, NextChapter-branded résumé page for your firm (`launchyournextchapter.com/in/<firm>`), a free candidate CRM behind it,
and candidates who each get a plan. Candidates are happy because someone answers them and they get free help. Recruiters never
have to chase anyone: they see where each candidate stands, with the candidate's consent.

## What already exists (read from the code)

| Pitch element | Exists | Where |
|---|---|---|
| Public recruiter page | Yes | `/recruiters`, copy in `src/lib/marketing/portal-pages/recruiters.ts` |
| Firm-branded résumé page | Yes, logo, colors, font | `/in/<firm>`, `/in/<firm>/<recruiter>`, `src/components/talent-intake/` |
| Collect résumés | Yes: page, forwarded email, "not a fit now" link, members who express interest | `IntakeConnection`, `IntakeResume` |
| Parse and sort | Yes: résumé read, tag Fit / Niche / Outside, routing to a recruiter | `src/lib/recruiter/intake/` |
| Recruiter hopper | Yes | `/recruiters/talent` |
| Push to their tools | Yes: signed webhooks, ATS export file (Greenhouse, Lever, Bullhorn) | `webhooks.ts`, `ats-export.ts` |
| Stage tracking | Yes, but for submissions of NextChapter pool candidates, not for intake candidates | `submission-stages.ts` |
| Candidate consent | Collected: `status`, `landing_details`, `profile_updates`, `contact` | `intake/constants.ts` |

## Gaps against the pitch

1. **Nothing reads the consent scopes.** `status`, `landing_details` and `profile_updates` are stored, but the recruiter's
   candidate page (`/recruiters/talent/[id]`) shows only the list of what was shared. This is the "track and monitor" promise
   and it is not delivered. Biggest gap.
2. **Hopper, not CRM.** An intake candidate has a tag and an assignee. I found no stage, note, next step or follow-up date for
   them. "Free CRM" needs these.
3. **"Candidates have a plan" is not visible to the recruiter.** The candidate side has plans and stages
   (`docs/CANDIDATE_STAGES.md`); the recruiter sees none of it, even with consent.
4. **"Don't bother them" is unbuilt.** The recruiter has only "message them" (`contact` scope). Needed: NextChapter does the
   check-ins; the recruiter sees the answer; the recruiter gets a quiet digest, not a reason to chase.
5. **Activation friction.** Pages go live only after a firm is VERIFIED by NextChapter staff (about one business day). Fine
   for a trickle, wrong for a pilot of 500.
6. **Pitch copy** leads with candidate search and packets, not with the free résumé page, CRM and monitoring.

## Proposed build, smallest first

1. **Candidate status on the recruiter's page.** Show search status, plan stage and landing details, each only if its consent
   scope is granted, with the date it last changed. Remove the "what they share" bullet list in favor of the data itself, so the
   page does not grow (candidate-redesign rule applies to the candidate site; same discipline here).
2. **A pipeline for intake candidates.** Stage (New, Talking, Presented, Placed, Not a fit), one note, one next-step date. List
   view sorted by next step. Reuse the submission stage log so every change is dated.
3. **Quiet monitoring.** One weekly digest per recruiter: who changed status, who landed, who went quiet. No per-event emails.
   Candidate-side check-ins come from NextChapter on the candidate's existing cadence, never from the recruiter's account.
4. **Pilot activation.** Auto-verify pilot firms (domain and LinkedIn check by staff in batch) or let the page go live
   immediately with a "pending verification" mark. Owner to choose.
5. **Pitch page rewrite** in `recruiters.ts`: headline on the free branded page and CRM. One registration ask only (NextStepBox
   rule). Built in `src/app/dev-preview/` first, screenshot reviewed before it replaces the live page.
6. **Analytics** (CLAUDE.md rule): `talent_pipeline_stage_changed`, `talent_status_viewed`, `talent_digest_opened`,
   `recruiter_pilot_firm_activated`, each with `firmId`, `recruiterId`, `connectionId`.

## Test design for 500

- **Who:** 500 recruiters and search-firm contacts from the CRM, excluding suppressed people, `warm_contacts`, and anyone who
  already has a recruiter account. Count the pool before promising 500; I have not queried it.
- **How to reach them, without email:** to decide. Options: LinkedIn messages from the owner, warm introductions, a note on the
  `/search-firms` listing a firm already claims, and inbound from the existing `RecruiterInterest` flow. October email got about
  0.3% human clicks, so email is not expected to carry this anyway.
- **One variable, two arms of 250:** the lead promise. A: "free branded résumé page". B: "free CRM that tracks your candidates".
  Split by a hash of the address.
- **Success is activation, not clicks:**
  1. firm created and page live,
  2. at least 3 real candidate résumés received in 14 days,
  3. recruiter opens the pipeline in week 2.
  Target to decide before launch; 250 per arm only detects a large difference.
- **Stop conditions:** any candidate complaint about being contacted, any consent scope shown without a grant.

## Constraints that shape the design

- Never write to a member's Google account (owner rule 2026-10-25); nothing above does.
- Consent is per firm and per scope; the recruiter sees nothing outside a granted scope.
- Automatic replies to Niche/Outside candidates stay off until counsel clears NYC Local Law 144.
- Unclaimed intake profiles are purged at 60 days; the CRM must not imply otherwise.
- Egress: the pipeline and digest read one firm's connections (bounded, `take`), not tables.

## Decisions for the owner

1. Reach channel for the 500, since not email.
2. Pilot activation: auto-verify, or live-while-pending.
3. Whether recruiters see candidate status only on consent (recommended) or whether the candidate's plan stage is always shown to
   a firm they submitted to.
4. Success targets for activation.
