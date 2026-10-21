// Backfill: snapshots what every applied application's job asked for and how the member's skills
// lined up (src/lib/applications/skill-snapshot.ts). Linked applications read the board posting;
// unlinked ones with a title fall back to the title's O*NET occupation (labelled inferred).
// Idempotent: existing snapshots are kept unless the application's posting link changed.
// --rebuild-inferred re-reads inferred (title-based) rows after the inference rules change.
// --refresh-facts re-reads a posting row's function / sub-function / occupation after the posting was re-classified
// (what it asked and the match at the time stay frozen). --ids <file> limits the run to those application ids
// (one per line), e.g. the applications whose postings a re-classification moved.
// Run the board-link backfill first so as many applications as possible have a posting:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-application-board-links.ts --only-unmatched
// Then:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-application-skill-snapshots.ts
// No AI cost.

import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma'
import { backfillApplicationSnapshots } from '../src/lib/applications/skill-snapshot-data'

function idsArg(): string[] | undefined {
  const i = process.argv.indexOf('--ids')
  if (i < 0) return undefined
  const file = process.argv[i + 1]
  if (!file) throw new Error('--ids needs a file of application ids')
  return readFileSync(file, 'utf8').split(/\s+/).filter(Boolean)
}

async function main() {
  const appIds = idsArg()
  const res = await backfillApplicationSnapshots({
    rebuildInferred: process.argv.includes('--rebuild-inferred'),
    refreshFacts: process.argv.includes('--refresh-facts'),
    appIds,
  })
  if (appIds) console.log(`limited to ${appIds.length} application ids`)
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
