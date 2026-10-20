import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildMarketTargetStats } from '@/lib/market/market-size-stats'

export const maxDuration = 300

// Nightly market-size counts (src/lib/market/market-size.ts): open jobs and the 14 / 28-day
// opened and closed windows per function x sub-function x level x industry x place, for
// the market-size prompts on the board, Search Strategy and Market Reality. Rerun-safe.
export const GET = withCronRun('market-size', async () => {
  const result = await rebuildMarketTargetStats()
  return NextResponse.json(result)
})
