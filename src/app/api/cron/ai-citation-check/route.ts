import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runCitationCheck } from '@/lib/ai-visibility/run'

export const maxDuration = 300

// Weekly (Monday). Asks the tracked prompts of AI assistants and records whether we are cited. Capped monthly, see run.ts.
export const GET = withCronRun('ai-citation-check', async () => NextResponse.json(await runCitationCheck()))
