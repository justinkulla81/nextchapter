import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { prisma } from '@/lib/prisma'
import { snapshotVisitorTypes } from '@/lib/admin/visitor-day-types'
import { etDateKey } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 300

const DAY_MS = 86_400_000
// The first day with any visit (2026-08-08); earlier days have no data.
const FIRST_DAY = '2026-08-08'
const MISSING_PER_RUN = 20

// Stores each human visitor's type per Eastern day (VisitorDayType) for the Visitors > Activity "Visitors by type" chart.
// Every run redoes today and yesterday (today fills in during the day), then fills up to 20 past days that have no rows yet, newest first,
// so the history backfills itself over the first runs. ?backfill=N redoes the last N days instead (up to 60).
// Rerun-safe: a day's rows are replaced. Reads one day of visits grouped by IP per day processed, a few thousand rows each.
export const GET = withCronRun('visitor-day-types', async (request: NextRequest) => {
  const asked = Number(request.nextUrl.searchParams.get('backfill'))
  const now = Date.now()
  const lastN = (n: number) => Array.from({ length: n }, (_, i) => etDateKey(new Date(now - (n - 1 - i) * DAY_MS)))
  let days: string[]
  if (Number.isFinite(asked) && asked > 0) {
    days = lastN(Math.min(Math.floor(asked), 60))
  } else {
    const have = new Set((await prisma.visitorDayType.findMany({ distinct: ['day'], select: { day: true } })).map((r) => r.day))
    const recent = lastN(2)
    const missing: string[] = []
    for (let t = new Date(`${FIRST_DAY}T12:00:00Z`).getTime(); t <= now; t += DAY_MS) {
      const d = etDateKey(new Date(t))
      if (!have.has(d) && !recent.includes(d)) missing.push(d)
    }
    days = [...missing.slice(-MISSING_PER_RUN), ...recent]
  }
  const results = []
  for (const day of days) results.push(await snapshotVisitorTypes(day))
  return NextResponse.json({ days: results })
})
