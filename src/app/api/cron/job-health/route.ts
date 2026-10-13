import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runJobWatchdog } from '@/lib/cron/watchdog'

export const maxDuration = 60

/**
 * Every 15 minutes: finds scheduled jobs that were cut off, are failing, or
 * have stopped starting, and emails once a day per broken job.
 */
export const GET = withCronRun('job-health', async () => NextResponse.json(await runJobWatchdog()))
