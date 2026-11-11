import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { warmSharedBoard } from '@/lib/jobs/board-shortlist'
import { finishesWithin } from '@/lib/job-search-daily/run-outcome'

export const maxDuration = 300

// Runs in the 12:00 bundle just before job-search-daily, in the same server instance. A deploy starts with no board snapshot for
// its build, so the first board read is a cold read of every live job from the database (over 150 s on 2026-11-11, when
// job-search-daily gave up and no member got the email). Loading it here writes the snapshot and leaves the board in memory, so
// job-search-daily finds it ready. It never fails the bundle: if the load is slow it keeps going in the background and
// job-search-daily decides what to do. Reads the board once per day (the same read any cold instance does); sends nothing.
const WARM_MS = 200_000

export const GET = withCronRun('board-warm', async () => {
  const warm = await finishesWithin(warmSharedBoard(), WARM_MS)
  return NextResponse.json({ loaded: warm.ok, ms: warm.ms, ...(warm.ok ? {} : { reason: warm.reason }) })
})
