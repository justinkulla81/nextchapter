import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runLeadNurture } from '@/lib/leads/nurture/run'

export const maxDuration = 300

// The three-email follow-up for people who gave us an email on the site and have not become members (docs/LEAD_NURTURE.md).
// Sends nothing until NURTURE_EMAILS=1; until then the response is a dry run: counts and subjects, no addresses, no writes.
export const GET = withCronRun('lead-nurture', async () => NextResponse.json(await runLeadNurture()))
