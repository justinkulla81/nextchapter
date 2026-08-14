import { NextResponse, type NextRequest } from 'next/server'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computePopulationSnapshotRows, upsertPopulationSnapshotRows } from '@/lib/analytics/population-metrics'

// Weekly population-report snapshot — Phase 2 Master Script, Part B,
// Prompt 6. Monday 00:15 UTC (see vercel.json) — deliberately earlier than
// market-reality-snapshot (Monday 20:20 UTC): this snapshot reads
// composition/funnel/activity signals that don't depend on that week's
// Sprint having been auto-assigned yet, so there's no ordering dependency
// forcing it later in the day.
//
// Idempotent via UPSERT, not skip-if-exists — spec Prompt 6 explicitly
// wants "rerunning a week overwrites cleanly," the opposite of the
// market-reality-snapshot precedent's findUnique-then-return-early pattern
// (that cron never overwrites a prior week; this one always does). Each
// (weekStartDate, segmentType, segmentValue) row upserts independently
// against PopulationSnapshot's real unique constraint on those three
// columns, so a partial prior run (e.g. a mid-run crash) is safely
// overwritten rather than left half-stale.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())

  let rows: Awaited<ReturnType<typeof computePopulationSnapshotRows>> = []
  try {
    rows = await computePopulationSnapshotRows(weekStartDate)
  } catch (error) {
    console.error('population-snapshot: computePopulationSnapshotRows failed', error)
    return NextResponse.json({ error: 'Snapshot computation failed' }, { status: 500 })
  }

  // upsertPopulationSnapshotRows already applies its own per-row
  // try/catch/log-and-continue (see that function) so one segment's write
  // failure can't take down the rest of the run.
  const written = await upsertPopulationSnapshotRows(weekStartDate, rows)

  return NextResponse.json({ weekStartDate: weekStartDate.toISOString(), computed: rows.length, written })
}
