import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runJobWatchdog } from '@/lib/cron/watchdog'

export const maxDuration = 300

/**
 * Every 15 minutes: finds scheduled jobs that were cut off, are failing, or
 * have stopped starting, and retries a failed safe job once, and emails once a day per broken job.
 */
export const GET = withCronRun('job-health', async () => NextResponse.json(await runJobWatchdog()))
