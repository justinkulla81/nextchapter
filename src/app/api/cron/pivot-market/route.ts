import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildPivotMarketStats } from '@/lib/pivots/rebuild-market-stats'

export const maxDuration = 300

// Nightly market aggregates for pivot paths (src/lib/pivots/market-stats.ts):
// open roles, trend windows, low-competition share and posted pay per pivot
// role x state x level band, from the board. Paged reads, one swap write.
// Rerun-safe: it rebuilds the whole table each time.
export const GET = withCronRun('pivot-market', async () => {
  const result = await rebuildPivotMarketStats()
  return NextResponse.json(result)
})
