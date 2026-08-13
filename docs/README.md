# NextChapter Docs

Zero-context reference set for the NextChapter codebase. Start with **Setup & Operations** if you're new — it covers running the app at all. Then read whichever product doc matches what you're touching.

| Doc | What it covers |
|---|---|
| [SETUP.md](./SETUP.md) | External services, environment variables, local dev, deploys, scheduled cron jobs — "how do I run this and keep it running." |
| [PRODUCT_VISION_CANDIDATE.md](./PRODUCT_VISION_CANDIDATE.md) | Everything a candidate (job seeker) sees and does — onboarding, grading/points/badges, every dashboard page, Victoria the AI coach, candidate emails. |
| [PRODUCT_VISION_ADMIN_ORGS.md](./PRODUCT_VISION_ADMIN_ORGS.md) | Everything that isn't the candidate dashboard — internal admin portal, coach/recruiter/employer portals, NC Job Board, Employer Reference, Market Pulse, cross-portal messaging, org marketing pages. |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Readable map of `prisma/schema.prisma`'s ~69 models, grouped by domain, with the schema-wide house rules (no migration history, `cuid()` ids, append-only history models). |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual/interaction design: tokens, typography, component patterns, status/grade/empty-state conventions. Pairs with [design-principles.md](../design-principles.md), the binding rule set every new feature is checked against. |
| [SCRIPTS.md](./SCRIPTS.md) | Every standalone `tsx` script in `scripts/` — seeding, backfills, test-account creation — and what each one does. |
| [ASSESSMENT_AUDIT.md](./ASSESSMENT_AUDIT.md) | Pre-build audit for the Assessment Layer spec (Skills & Behavioral Assessments · Reference Check · Report Redesign) — historical record, not a living reference. |

## Conventions across all docs

- File paths are relative to the repo root (`/Users/salitkulla/nextchapter`) unless stated otherwise.
- These are handoff docs, not the source of truth — when a doc and the code disagree, the code is right. Update the doc.
- No doc here duplicates `prisma/schema.prisma`'s own inline comments (the *why* behind each field) — read the schema file directly for that.
