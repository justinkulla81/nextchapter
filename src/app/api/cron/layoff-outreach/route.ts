import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runOutreachSweep } from '@/lib/warn/outreach/sweep'

export const maxDuration = 300

// Hourly: emails the contacts of layoffs of 50+ jobs that never got a full alert (the alert path covers 250+ and CRM employers).
// Reads at most 60 notices and their outreach editions per run; sends nothing itself (the mailing-send cron does).
export const GET = withCronRun('layoff-outreach', async () => NextResponse.json(await runOutreachSweep()))
