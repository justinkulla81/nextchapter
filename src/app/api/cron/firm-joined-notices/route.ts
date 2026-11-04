import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runFirmJoinedNotices } from '@/lib/recruiter-interest/joined-notice'

// Daily, in the 12:00 UTC bundle: emails each member once when a search firm they picked has joined. Sends nothing to the firm;
// the member chooses on their recruiter package page whether to send their résumé.
export const maxDuration = 300

export const GET = withCronRun('firm-joined-notices', async () => NextResponse.json(await runFirmJoinedNotices()))
