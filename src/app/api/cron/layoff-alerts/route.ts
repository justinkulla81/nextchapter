import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runLayoffAlerts } from '@/lib/leads/layoff-alerts'

export const maxDuration = 300

// Daily layoff watch: bell notices for members whose employer filed a WARN notice, and (once LAYOFF_ALERT_EMAILS=1)
// emails for confirmed watches. Off, the email part is a dry run: counts only, no addresses.
export const GET = withCronRun('layoff-alerts', async () => NextResponse.json(await runLayoffAlerts()))
