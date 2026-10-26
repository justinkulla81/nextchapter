import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runJobAlerts } from '@/lib/leads/job-alerts'

export const maxDuration = 300

// Daily job alert emails for confirmed saved searches (HomepageLead kind job_alert). Sends nothing until
// JOB_ALERT_EMAILS=1; until then the response is a dry run: counts and sample titles, no addresses.
export const GET = withCronRun('job-alerts', async () => {
  const summary = await runJobAlerts()
  return NextResponse.json(summary)
})
