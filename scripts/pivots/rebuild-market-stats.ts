// One-off / manual run of the nightly pivot-market job (same code as /api/cron/pivot-market).
// npm run pivots:rebuild
import { rebuildPivotMarketStats } from '@/lib/pivots/rebuild-market-stats'
import { prisma } from '@/lib/prisma'

rebuildPivotMarketStats()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
