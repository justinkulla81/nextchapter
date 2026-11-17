import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildRankings, type BuildResult } from '@/lib/rankings/build'
import { staleGroups } from '@/lib/rankings/method-version'
import { readRankingMethods } from '@/lib/rankings/store'

export const maxDuration = 800

// Hourly: rebuilds the groups of ranking lists whose stored lists were built with an older method (method-version.ts), so a
// change to how a list is built reaches the site within the hour instead of at the next monthly run. Most hours nothing is
// stale and it reads one small row. A group is started only while there is time left for it (the slowest takes ~5 minutes).
const BUDGET_MS = 9 * 60_000

export const GET = withCronRun('rankings-refresh', async (_request: NextRequest) => {
  const started = Date.now()
  const stale = staleGroups(await readRankingMethods())
  const results: BuildResult[] = []
  const failed: string[] = []
  for (const g of stale) {
    if (Date.now() - started > BUDGET_MS) break
    try {
      results.push(await buildRankings(g))
    } catch (e) {
      console.error('rankings-refresh: group failed', g, e)
      failed.push(g)
    }
  }
  return NextResponse.json({ stale, results, failed }, { status: failed.length ? 500 : 200 })
})
