// Builds this month's rankings and stores them, the same work as the monthly cron /api/cron/rankings.
//
//   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/rankings/build.ts
import { buildRankings } from '@/lib/rankings/build'

buildRankings()
  .then((r) => {
    console.log(JSON.stringify({ ...r, skipped: r.skipped.length, skippedSlugs: r.skipped }, null, 2))
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
