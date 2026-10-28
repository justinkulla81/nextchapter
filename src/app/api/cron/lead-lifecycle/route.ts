import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runLeadLifecycle } from '@/lib/leads/lifecycle/run'

export const maxDuration = 300

// Files everyone who gave us an email on the site in the CRM and, once LEAD_LIFECYCLE_EMAILS=1, sends the welcome and
// reminder emails that are due. Off, it is a dry run: counts only, no addresses, nothing sent.
export const GET = withCronRun('lead-lifecycle', async () => NextResponse.json(await runLeadLifecycle()))
