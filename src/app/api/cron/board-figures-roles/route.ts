import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshRoleBoardFigures } from '@/lib/jobs/refresh-board-figures'

// The entry-level role pages' and /roles pages' stored figures (src/lib/jobs/refresh-board-figures.ts), split out of
// /api/cron/board-figures on 2026-11-20: together the run reached 768 s of 800 s, and the entry-role scan needs a 5-minute statement limit.
// Two scans of about 2 minutes each. Rerun-safe: each run overwrites the same rows; a step that fails keeps its previous rows.
export const maxDuration = 800

export const GET = withCronRun('board-figures-roles', async () => {
  const result = await refreshRoleBoardFigures()
  return NextResponse.json(result, { status: result.failed.length ? 500 : 200 })
})
