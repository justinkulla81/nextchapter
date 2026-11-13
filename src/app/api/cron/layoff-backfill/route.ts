import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runBackfillAuto } from '@/lib/warn/outreach/backfill'

export const maxDuration = 300

// Hourly: makes the held drafts for the layoffs of the last 60 days that were never emailed (src/lib/warn/outreach/backfill.ts), and once
// they are all drafted schedules them across Monday to Thursday of the next week with a headline test each day. Off: LAYOFF_BACKFILL_AUTO=0.
export const GET = withCronRun('layoff-backfill', async () => NextResponse.json(await runBackfillAuto()), { recordResult: true })
