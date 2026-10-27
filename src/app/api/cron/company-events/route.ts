import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { ingestRecentSecEvents } from '@/lib/events/sec-events'

export const maxDuration = 300

/** Daily: the last four weekdays of SEC 8-Ks and Form Ds, so a late filing or a missed day is picked up. No AI, no paid API. */
export const GET = withCronRun('company-events', async () => {
  return NextResponse.json(await ingestRecentSecEvents(4))
})
