import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshBoardFigures } from '@/lib/jobs/refresh-board-figures'

// 800 s, not 300: the run is six whole-board scans in a row (about 190 s on 2026-11-02) and the job-title step now also stores one row per
// title-by-place page, and the 18:10 UTC run that first included it timed out at 300 s. A step that fails keeps its previous rows.
export const maxDuration = 800

// Refreshes the stored whole-board figures (src/lib/jobs/refresh-board-figures.ts) that the top-employers pages, the
// workforce page and the jobs-by-AI-exposure split read, so no public page runs a full-board scan itself.
// Rerun-safe: each run overwrites the same rows.
export const GET = withCronRun('board-figures', async () => {
  const result = await refreshBoardFigures()
  return NextResponse.json(result, { status: result.failed.length ? 500 : 200 })
})
