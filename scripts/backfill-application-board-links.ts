// One-time backfill: links every applied application (JobPosting) to the board
// posting it was for (src/lib/jobs/application-posting-match.ts) and stores the
// link, method and confidence on the application. Idempotent — re-running
// re-matches. Writes only once prisma/manual/2026-10-16-application-board-link.sql
// is applied; before that --dry is implied and it just prints the counts.
// The admin application-fit page also links never-matched applications on load,
// so this is a catch-up, not a requirement. No AI cost.
//
// Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-application-board-links.ts [--dry] [--only-unmatched]

import { prisma } from '../src/lib/prisma'
import { backfillApplicationLinks, boardLinkColumnsReady } from '../src/lib/jobs/application-posting-link'

async function main() {
  const ready = await boardLinkColumnsReady()
  const dryRun = process.argv.includes('--dry') || !ready
  if (!ready) console.log('Link columns not applied yet — dry run (nothing stored).')
  const res = await backfillApplicationLinks({ dryRun, onlyUnmatched: process.argv.includes('--only-unmatched') })
  console.log(`applications=${res.applications} stored=${res.stored}`)
  for (const [method, n] of Object.entries(res.counts)) console.log(`  ${method.padEnd(14)} ${n}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
