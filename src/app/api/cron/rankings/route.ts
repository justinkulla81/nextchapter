import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildRankings, type BuildResult } from '@/lib/rankings/build'
import { rebuildAwardBook } from '@/lib/rankings/store'
import type { BuildGroup } from '@/lib/rankings/types'
import { builtThisMonth } from '@/lib/rankings/cadence'

export const maxDuration = 800

// Builds this month's edition of the rankings (src/lib/rankings) and stores it. The five groups of lists are packed into three
// scheduled runs so each stays inside the time limit and the project stays inside its cron count:
//   ?run=a (default): places, workforce, then support      ?run=b: functions, skills, then metro      ?run=c: college, industry, then profile
// ?group=<name> builds one group on its own (for a manual rerun), e.g. metro (the best places for white-collar professionals).
// Rerun-safe: a second run in the same month overwrites that month's rows.
const GROUPS: BuildGroup[] = ['places', 'functions', 'skills', 'workforce', 'college', 'industry', 'profile', 'support', 'metro']
const RUNS: Record<string, BuildGroup[]> = { a: ['places', 'workforce', 'support'], b: ['functions', 'skills', 'metro'], c: ['college', 'industry', 'profile'] }

export const GET = withCronRun('rankings', async (request: NextRequest) => {
  const param = request.nextUrl.searchParams.get('group')
  // ?group=awards rebuilds every month's placings (the awards on place, job and employer pages) from the stored editions.
  if (param === 'awards') return NextResponse.json(await rebuildAwardBook())
  const asked = param as BuildGroup | null
  // A scheduled run skips a quarterly group (best places) outside January, April, July and October; ?group= builds it any time.
  const groups = asked && GROUPS.includes(asked) ? [asked] : (RUNS[request.nextUrl.searchParams.get('run') ?? 'a'] ?? RUNS.a).filter((g) => builtThisMonth(g, new Date()))
  const results: BuildResult[] = []
  const failed: string[] = []
  for (const g of groups) {
    try {
      results.push(await buildRankings(g))
    } catch (e) {
      console.error('rankings: group failed', g, e)
      failed.push(g)
    }
  }
  return NextResponse.json({ results, failed }, { status: failed.length ? 500 : 200 })
})
