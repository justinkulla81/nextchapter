import { NextResponse } from 'next/server'
import { runWinBack } from '@/lib/email/dispatch/run-win-back'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (Wednesday 15:00 UTC). Sends the next win-back step, if one is due, to
// members who have gone quiet. Steps are at least 14 days apart.
export const GET = withCronRun('win-back', async () => NextResponse.json(await runWinBack()))
