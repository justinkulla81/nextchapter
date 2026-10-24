import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runConferenceRecheck } from '@/lib/conferences/recheck'

// Weekly. Rolls finished editions to next year ("Dates TBA") and re-reads followed conference sites. Page reads are free;
// a model call happens only when a page changed since its baseline, capped per run. Changes wait for confirmation.
export const maxDuration = 300
export const GET = withCronRun('conference-recheck', async () => NextResponse.json(await runConferenceRecheck()))
