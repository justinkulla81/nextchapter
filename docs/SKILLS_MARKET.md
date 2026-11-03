# Skills market

Public lists of the skills live postings ask for, cross-referenced by industry, function, state and seniority. No model calls.

- **Data.** `ExclusiveJobPosting.skills` (the fixed vocabulary in `src/lib/companies/skills-extraction.ts`, read from the full posting text), with each posting's industry, function, state, level, `socCode` and age. About 296k of 563k live postings name at least one skill (2026-11-03); every share is of postings that name a skill, and the page says so.
- **Snapshot.** `computeSkillsMarket` (`src/lib/skills/market-server.ts`) runs one statement per grouping and stores a `SkillMarketSnapshot` row; cron `/api/cron/skills-market` runs it daily (23:55 UTC, after `ai-market`). Pages read the newest row, so none scans the board. DDL: `prisma/manual/2026-11-03-skills-market.sql`.
- **Lists** (`src/lib/skills/market.ts`, pure, tested in `src/test/skills-market.test.ts`): most-asked overall; most-asked inside one industry, function, state or level; where one skill is asked most; rising (share among postings from the last 30 days over share among all); AI exposure (mean Anthropic Economic Index observed exposure of the occupations of the postings asking for the skill, most and least); skills asked for alongside a specific AI skill; and `skillGap` (a member's skills against any of those lists).
- **Pages.** `/skills`, `/skills/[slug]`, `/skills/by/[dimension]/[key]`. Unknown slugs redirect to `/skills`.
- **Watch a skill.** `SkillWatch` rows, set by `setSkillWatched` (`src/app/skills/watch-actions.ts`). Events: `skill_watched`, `skill_unwatched` (server), `skills_browse_clicked`, `topic_cta_clicked` (client).
- **Exposure caveat.** It describes the work behind the skill, not a forecast of job loss; a low number means no use observed yet.
