import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { buildRankings } from '@/lib/rankings/build'
import { rebuildAwardBook } from '@/lib/rankings/store'
import type { BuildGroup } from '@/lib/rankings/types'

export const maxDuration = 800

// Builds this month's edition of one group of rankings (src/lib/rankings) and stores it: ?group=places (the default: city and
// county lists), functions (job-family city lists) or skills (AI skills, tools, certifications). The groups are separate jobs so
// each stays inside the time limit. Rerun-safe: a second run in the same month overwrites that month's rows.
const GROUPS: BuildGroup[] = ['places', 'functions', 'skills']

export const GET = withCronRun('rankings', async (request: NextRequest) => {
  const asked = request.nextUrl.searchParams.get('group') as BuildGroup | 'awards' | null
  // ?group=awards rebuilds every month's placings (the awards on place, job and employer pages) from the stored editions.
  if (asked === 'awards') return NextResponse.json(await rebuildAwardBook())
  const group = asked && GROUPS.includes(asked) ? asked : 'places'
  return NextResponse.json(await buildRankings(group))
})
