import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildRankings, type BuildResult } from '@/lib/rankings/build'
import { rebuildAwardBook } from '@/lib/rankings/store'
import type { BuildGroup } from '@/lib/rankings/types'

export const maxDuration = 800

// Builds this month's edition of the rankings (src/lib/rankings) and stores it. The five groups of lists are packed into three
// scheduled runs so each stays inside the time limit and the project stays inside its cron count:
//   ?run=a (default): places, then workforce      ?run=b: functions, then skills      ?run=c: college
// ?group=<name> builds one group on its own (for a manual rerun): places, functions, skills, workforce or college.
// Rerun-safe: a second run in the same month overwrites that month's rows.
const GROUPS: BuildGroup[] = ['places', 'functions', 'skills', 'workforce', 'college']
const RUNS: Record<string, BuildGroup[]> = { a: ['places', 'workforce'], b: ['functions', 'skills'], c: ['college'] }

export const GET = withCronRun('rankings', async (request: NextRequest) => {
  const param = request.nextUrl.searchParams.get('group')
  // ?group=awards rebuilds every month's placings (the awards on place, job and employer pages) from the stored editions.
  if (param === 'awards') return NextResponse.json(await rebuildAwardBook())
  const asked = param as BuildGroup | null
  const groups = asked && GROUPS.includes(asked) ? [asked] : RUNS[request.nextUrl.searchParams.get('run') ?? 'a'] ?? RUNS.a
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
