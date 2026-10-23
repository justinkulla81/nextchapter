import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runConferenceHeadsUp } from '@/lib/events/run-heads-up'

// Daily. Sends nothing until CONFERENCE_HEADSUP_ENABLED=1 (see run-heads-up.ts).
export const maxDuration = 300
export const GET = withCronRun('conference-heads-up', async () => NextResponse.json(await runConferenceHeadsUp()))
