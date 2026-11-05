import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runLeadLifecycle } from '@/lib/leads/lifecycle/run'
import { runAbandonedStarts } from '@/lib/onboarding/abandoned-run'

export const maxDuration = 300

// Files everyone who gave us an email on the site in the CRM and, once LEAD_LIFECYCLE_EMAILS=1, sends the welcome and
// reminder emails that are due. Off, it is a dry run: counts only, no addresses, nothing sent.
// Also runs the "pick up where you left off" pass for people who started onboarding and left an email (ABANDONED_START_EMAILS=1
// sends; see src/lib/onboarding/abandoned-start.ts). It runs every few minutes, so the first email goes out within about
// half an hour of someone asking for the link. A failure in that pass never fails the lifecycle run.
export const GET = withCronRun('lead-lifecycle', async () => {
  const lifecycle = await runLeadLifecycle()
  const abandonedStarts = await runAbandonedStarts().catch((error) => {
    console.error('Abandoned-start pass failed:', error)
    return { error: 'failed' as const }
  })
  return NextResponse.json({ ...lifecycle, abandonedStarts })
})
