import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runEventsRefresh } from '@/lib/events/run-refresh'

// Daily and free (plain HTTP, no model): rolls finished editions forward, checks a rotating slice of event links,
// takes newly announced dates from the event's own page, and hides events whose link stays dead.
export const maxDuration = 300
export const GET = withCronRun('events-refresh', async () => NextResponse.json(await runEventsRefresh()))
