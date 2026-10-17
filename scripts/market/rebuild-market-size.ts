// Rebuilds MarketTargetStat now (the nightly cron market-size does the same).
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/market/rebuild-market-size.ts
import { prisma } from '../../src/lib/prisma'
import { rebuildMarketTargetStats } from '../../src/lib/market/market-size-stats'

rebuildMarketTargetStats()
  .then((r) => console.log(r))
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
