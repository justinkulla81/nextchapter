# Scripts — seeding, resets, and test data

Everything here is a standalone TypeScript script run via `tsx`, not part of the app runtime or build. All of them talk directly to the real configured Supabase/Postgres instance in `.env.local` — there's no separate "local-only" database, so be deliberate about which environment's `.env.local` is active before running any of these against a shared dev or production database.

## Permanent scripts (`scripts/`, wired up as `npm run` commands)

### Create sample/test candidates
```bash
npm run seed:test-candidates
```
Creates 20 distinct fixture candidates spanning a spread of functions/levels/geos/circumstances (`scripts/seed-test-candidates.ts`) — some deliberately similar (same function+city, different level) to exercise search/matching, some very different. Split across four activity tiers (A: highly active with streak + A-List, B: moderate, C: low, D: dormant/just signed up) so admin list/drill-down pages have something realistic to show. Each is a real Supabase auth user (admin-created, no password set — nobody logs into these) plus a full `CandidateProfile` with grade history, weekly sprint/report activity, and check-in streaks as appropriate for the tier. All 20 share the `@nextchapter.test` email domain.

It's delete-then-create, not an upsert — re-running always leaves exactly these 20 rows, nothing duplicated.

### Delete the sample/test candidates
```bash
npm run seed:test-candidates -- --delete
```
Same script, `--delete` flag — deletes the fixture set (matched by the `@nextchapter.test` domain) and exits without recreating.

### Delete a real user completely (dev/QA reset)
```bash
npm run reset:users -- someone@example.com another@example.com
```
`scripts/reset-users.ts` — fully deletes one or more users by email: their `CandidateProfile` (and everything that cascades from it — resumes, work samples, references, reports, sprints, community posts, etc.) plus their Supabase auth account. Lets a real email go through signup/onboarding again from scratch. This is the tool for "I tested with my own email and want to redo onboarding," not for the `@nextchapter.test` fixtures above (use `--delete` for those).

### Seed Work Style Assessment content
```bash
npm run seed:assessment
```
`scripts/seed-assessment-content.ts` — one-time seed that generates quad-block/Likert/BARS assessment content via the Anthropic API and inserts it into the DB. This is LLM-generated psychometric content — a starting point, not professionally validated — review before using with real candidates. Inserts at a new `rotationGroup` so it doesn't collide with existing content; bump `CURRENT_ASSESSMENT_ROTATION_GROUP` in `src/lib/constants/onboarding.ts` to match after running.

### Seed dashboard messages
```bash
npm run seed:dashboard-messages
```
`scripts/seed-dashboard-messages.ts` — creates the pinned "How NextChapter works" dashboard message plus a few starter rotation messages. Safe to re-run — skips any title that already exists rather than duplicating.

### Connect the test coach/recruiter/hiring-manager accounts to test candidates
```bash
npm run seed:portal-connections
```
`scripts/seed-portal-connections.ts` — populates realistic cross-portal data connecting the three real test accounts (coach `justin.kulla+coach@gmail.com`, recruiter `justin.kulla+recruiter@gmail.com`, hiring manager `NC Test Co (Hiring Manager)`) to the 20 `@nextchapter.test` fixture candidates from `seed:test-candidates` (must be run first). Also sets profile pictures (pravatar.cc placeholder photos — real image URLs, no Storage upload needed) on the coach, the recruiter, and 15 of the 20 candidates.

Specifically: assigns 5 candidates as coach clients with 2 sessions each and one Coaching Onboarding Form response; gives the recruiter a sourced-candidate book (3 signed-up candidates + 2 external leads not yet on the platform) and 2 calibration memos; posts 3 open roles for the hiring manager and creates an 8-candidate pipeline across them spanning the full funnel (viewed → saved → interest expressed → revealed → in conversation → hired, plus one passed).

Does not touch auth credentials for the three test accounts — only adds/updates data rows connected to them. Safe to re-run — the connection rows it owns (sessions, sourced candidates, memos, roles, interactions) are deleted and recreated each run.

### Seed Interim Work page listings (marketplaces, expert networks, boards)
```bash
npm run seed:interim-listings
```
`scripts/seed-interim-listings.ts` — creates the initial `InterimListing` rows shown on the Interim Work page (fractional/talent marketplaces, expert networks, board & advisory sites, nonprofit-board alternatives). This is real page content the admin CRUD page (`/admin/interim-listings`) edits afterward, not test data — safe to re-run, it skips any `(category, name)` pair that already exists rather than overwriting admin edits.

## Scratch-script convention (not permanent, not in `scripts/`)

Throughout this build, one-off verification needs (e.g. "create a single test account with a specific edge-case profile shape and check a redirect works") were handled with disposable scripts in the project root, named `scratch-*.ts`/`.mjs` — written, run, then immediately deleted (`rm -f scratch-*.mjs`) once their purpose was served, so they never accumulate or get mistaken for permanent tooling. If you see a `scratch-*` file in the repo root, it's leftover cleanup, not something intentionally checked in — safe to delete after confirming it's not mid-use.

The pattern for "one specific test account" scratch scripts (rather than the 20-candidate fixture set above):
1. `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — creates a real auth user without going through the email-confirmation flow.
2. `prisma.candidateProfile.create({ data: { userId: created.user.id, ... } })` — with whatever minimal or edge-case field set the test needs.
3. If dashboard access is needed, a second scratch script sets the gating fields directly (`assessmentComplete: true`, `introCommittedAt: new Date()`, etc. — see `src/lib/dashboard/get-dashboard-data.ts` for the full gate chain) rather than manually clicking through onboarding.
4. Clean up afterward: delete the `CandidateProfile` row, then `supabase.auth.admin.deleteUser(userId)`.

**Never** used for resetting an *existing real* user's password or credentials — that's a hard boundary in this codebase (blocked by policy), enforced by always creating a brand-new throwaway account instead of touching a real one.
