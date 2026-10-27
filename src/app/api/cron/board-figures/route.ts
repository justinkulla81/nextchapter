import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshBoardFigures } from '@/lib/jobs/refresh-board-figures'

export const maxDuration = 300

// Refreshes the stored whole-board figures (src/lib/jobs/refresh-board-figures.ts) that the top-employers pages, the
// workforce page and the jobs-by-AI-exposure split read, so no public page runs a full-board scan itself.
// Rerun-safe: each run overwrites the same rows.
export const GET = withCronRun('board-figures', async () => {
  const result = await refreshBoardFigures()
  return NextResponse.json(result, { status: result.failed.length ? 500 : 200 })
})
