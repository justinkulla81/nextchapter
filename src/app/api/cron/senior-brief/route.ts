import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runSeniorBrief } from '@/lib/email/dispatch/run-senior-brief'

export const maxDuration = 300

// Mondays, early morning ET. Does nothing unless SENIOR_BRIEF_ENABLED=true. Who gets one and why is decided in
// src/lib/senior-brief/rules.ts.
export const GET = withCronRun('senior-brief', async () => NextResponse.json(await runSeniorBrief()))
