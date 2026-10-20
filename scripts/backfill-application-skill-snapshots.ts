// Backfill: snapshots what every applied application's job asked for and how the member's skills
// lined up (src/lib/applications/skill-snapshot.ts). Linked applications read the board posting;
// unlinked ones with a title fall back to the title's O*NET occupation (labelled inferred).
// Idempotent: existing snapshots are kept unless the application's posting link changed.
// --rebuild-inferred re-reads inferred (title-based) rows after the inference rules change; posting rows never move.
// Run the board-link backfill first so as many applications as possible have a posting:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-application-board-links.ts --only-unmatched
// Then:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-application-skill-snapshots.ts
// No AI cost.

import { prisma } from '../src/lib/prisma'
import { backfillApplicationSnapshots } from '../src/lib/applications/skill-snapshot-data'

async function main() {
  const res = await backfillApplicationSnapshots({ rebuildInferred: process.argv.includes('--rebuild-inferred') })
  const [total, byBasis] = await Promise.all([
    prisma.applicationSkillSnapshot.count(),
    prisma.applicationSkillSnapshot.groupBy({ by: ['basis'], _count: { _all: true } }),
  ])
  console.log(`applied applications=${res.applications} written now: posting=${res.posting} inferred=${res.inferred} skipped=${res.skipped}`)
  console.log(`snapshots stored in total=${total} ${byBasis.map((b) => `${b.basis}=${b._count._all}`).join(' ')}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
