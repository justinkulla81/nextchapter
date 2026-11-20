import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { sendsToday } from '@/lib/email/send-days'
import { refreshJobSocsSnapshot } from '@/lib/jobs/search-breadth-server'

// Reading the occupations takes ~6 minutes from the database, more than the 12:00 board-warm and Job Search Daily allow.
export const maxDuration = 800

// A snapshot younger than this is already good at noon (it is trusted for twelve hours): nothing is read.
const SKIP_IF_YOUNGER_MS = 10 * 60 * 60_000

// 10:50 UTC, on Job Search Daily's send days only (JOB_SEARCH_DAILY_DAYS): writes the job occupations snapshot so the 12:00 run
// loads it in seconds instead of reading the job table cold. Data: one read of ~570k narrow rows (~0.2 GB) on a send day, the
// same read the noon run did on its own before, so no more than before.
export const GET = withCronRun(
  'occupations-warm',
  async () => {
    if (!sendsToday(process.env.JOB_SEARCH_DAILY_DAYS, new Date())) return NextResponse.json({ paused: 'weekday', days: process.env.JOB_SEARCH_DAILY_DAYS })
    const started = Date.now()
    const out = await refreshJobSocsSnapshot(SKIP_IF_YOUNGER_MS)
    return NextResponse.json({ ...out, ms: Date.now() - started })
  },
  { recordResult: true }
)
