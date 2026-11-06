import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'
import { rebuildClosedPostingSnapshot } from '@/lib/jobs/ghost-risk-data'

export const maxDuration = 800

// The reconcile alone has taken up to 730 s, so it gets a budget that leaves the function time to finish.
const RECONCILE_BUDGET_MS = 600_000

// Nightly check on the board's narrow copy of the job table (BoardLightRow,
// board-light-rows.ts). Triggers keep it in step on every write, so this
// should find nothing to fix; it repairs whatever it does find, 20k ids at a
// time, and reports the count — a non-zero drift means a trigger was off.
// The closed-postings snapshot (ghost-risk-data.ts) that every server instance reads instead of grouping the closed
// postings itself is rebuilt FIRST: it is the short step, and when it ran after the reconcile the run was cut off before it
// (2026-11-06: no snapshot was ever written). A failure there fails the run (and alerts) but the repair still runs.
export const GET = withCronRun('board-light-rows', async () => {
  let snapshotError: unknown = null
  let closedPostingKeys: number | null = null
  try {
    closedPostingKeys = (await rebuildClosedPostingSnapshot()).keys
  } catch (error) {
    snapshotError = error
    console.error('Board light rows: closed-postings snapshot failed', error)
  }
  const result = await reconcileBoardLightRows({ budgetMs: RECONCILE_BUDGET_MS })
  if (result.upserted > 0 || result.deleted > 0) {
    console.error('Board light rows: nightly reconcile repaired drift', result)
  }
  if (snapshotError) throw snapshotError
  return NextResponse.json({ ...result, closedPostingKeys })
})
