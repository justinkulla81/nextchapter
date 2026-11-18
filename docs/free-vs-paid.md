# Free and paid: what is locked, and why anyone would open it

Owner request 2026-11-17: gated items must be attractive enough that a free organization wants to open them or start a trial.

## The rule
- **Free = see.** A claimed, verified organization sees its region, its page, its network and its partners, and acts for itself. Members are always free and unlimited (a free organization's staff see the first 5 by name).
- **Paid = act on people, and produce proof.** Anything that goes outward to a partner or funder, or that needs a team: partner views, the outcomes report and exports, every grant with a shortlist, staff roles, CRM exchange, activity log, WIOA reporting, NextChapter coaching and courses, the public-page section.
- Locked screens are previews, not walls: a one-line promise in the organization's own terms, three bullets, a labelled sample of the real screen, and one button.

## The trial (built)
- One 30-day trial per organization, started by its administrator from any lock screen ("Start your 30-day free trial"). While it runs the plan reads PAID everywhere (`effectivePlan`, applied where the workspace is resolved), and a pill in the header shows the days left with a mailto to keep it.
- It ends by date. The workspace is free again, nothing is deleted, and lock screens say "Your free trial has ended" with a link to ask for the paid plan back.
- NextChapter bills nothing; the paid plan is still switched on by staff (support@launchyournextchapter.com). Self-serve billing is a separate decision.
- Stored on `Institution.trialStartedAt` / `trialEndsAt` (`prisma/manual/institution-trial.sql`, applied 2026-11-17). Pure logic and the per-feature pitch copy: `src/lib/plans/entitlements.ts` (`trialState`, `effectivePlan`, `LOCK_PITCH`).

## What each locked item promises (LOCK_PITCH)
| Feature | The promise |
| --- | --- |
| Partner views | Give a college or employer a live view of your region; they plan programs around what employers ask for |
| Reporting and outcomes | Show funders what happened, in one page |
| Grants | Every grant that fits you, with our read, partners and next move |
| Skills gaps | See every skill your region is short of and the retraining that closes it (free sees the first three, the rest are a blurred preview) |
| Members | See everyone who joined, not the first five |
| Exports, CRM exchange, WIOA | Take your data with you; no double entry; reporting without the spreadsheet |
| Staff roles, activity log, SSO | Right access for each colleague; know who did what |
| Coaching and courses | Put NextChapter's coaching and AI-skills courses to work for your people |

## Measure it
PostHog: `entitlement_locked_viewed` (feature, trial), `plan_trial_started` (fromFeature), `entitlement_upgrade_requested`. The questions: which lock screen starts the most trials, and how many trials turn into a request for the paid plan.

## Still open
- Whether the trial should ask for a card (it does not today).
- The skills-gaps table is gated as a preview (owner decision 2026-11-17): free sees the first 3 skills in full, the rest blurred without numbers, and the "Retraining to close the gaps" section is paid. The talent snapshot is not gated.

## Education Hub (2026-11-18)
A workforce organization's training catalog: universities and colleges, third-party training, and training offered by the region (including courses NextChapter builds for it, flagged "Built by NextChapter for this region"). Three tabs: Catalog, Assign, Gaps and coverage.
- **Free = curate (see):** build the catalog, pull programs in from confirmed partner colleges, see which in-demand skills have no training yet.
- **Paid = assign (act on people):** choose who each training is for by industry, experience band (Individual contributor / Manager / Director or above) and function. An empty group means everyone; a person with no value on a named group is never matched. Assigned training shows in the person's Learn page ("Chosen for you by <org>") with who chose it and why. Reach is a count, hidden under 5. Feature `trainingAssign`, with the same trial and preview as every other lock.
- Data: `TrainingOffering` (`prisma/manual/training-offering.sql`, applied 2026-11-18). Pure rules: `src/lib/workforce/training-rules.ts`; reads: `src/lib/workforce/training.ts`.

## Workforce Hub and Partner Hub (2026-11-18)
- **Workforce Hub** (workforce organization staff, key `wfhub`, `/workforce-hub`): **Funding** (every application with the partners in on it, their parts, and the match each commits against what the funder requires; draft the ask to copy or open as an email, NextChapter sends nothing), **Partners** (every sister organization, nonprofit, funder, college and employer by type: economic development, workforce board, American Job Center, chamber, nonprofit, funder, college, employer, community group), **Feed**. Seeing the pipeline is free; recording partners and match is paid (`fundingPartners`, same trial and preview).
- **Partner Hub** (people at a confirmed partner, the existing `partnerview` workspace, now labelled Partner Hub on workforce portals): Your partnership, Shared with you, and the same **Feed**.
- **Feed** (`src/lib/workforce/feed.ts`): layoffs (the region's, and the largest filed nationally in 21 days), funding (federal notices closing within 45 days, the organization's own deadlines), rankings (where the main city places), data (regional unemployment). Cached 30 minutes per organization; every read narrow and bounded.
- Table `FundingPartnerCommitment` (`prisma/manual/funding-partner-commitment.sql`, applied 2026-11-18).
