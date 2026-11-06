import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'
import { rebuildClosedPostingSnapshot } from '@/lib/jobs/ghost-risk-data'

export const maxDuration = 800

// Nightly check on the board's narrow copy of the job table (BoardLightRow,
// board-light-rows.ts). Triggers keep it in step on every write, so this
// should find nothing to fix; it repairs whatever it does find, 20k ids at a
// time, and reports the count — a non-zero drift means a trigger was off.
// Then, with the copy in step, it rebuilds the closed-postings snapshot (ghost-risk-data.ts) that every server instance reads
// instead of grouping the closed postings itself. A failure there fails the run (and alerts); the repair above is already done.
export const GET = withCronRun('board-light-rows', async () => {
  const result = await reconcileBoardLightRows()
  if (result.upserted > 0 || result.deleted > 0) {
    console.error('Board light rows: nightly reconcile repaired drift', result)
  }
  const snapshot = await rebuildClosedPostingSnapshot()
  return NextResponse.json({ ...result, closedPostingKeys: snapshot.keys })
})
