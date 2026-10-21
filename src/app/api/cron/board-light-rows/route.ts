import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { reconcileBoardLightRows } from '@/lib/jobs/board-light-rows'

export const maxDuration = 300

// Nightly check on the board's narrow copy of the job table (BoardLightRow,
// board-light-rows.ts). Triggers keep it in step on every write, so this
// should find nothing to fix; it repairs whatever it does find, 20k ids at a
// time, and reports the count — a non-zero drift means a trigger was off.
export const GET = withCronRun('board-light-rows', async () => {
  const result = await reconcileBoardLightRows()
  if (result.upserted > 0 || result.deleted > 0) {
    console.error('Board light rows: nightly reconcile repaired drift', result)
  }
  return NextResponse.json(result)
})
