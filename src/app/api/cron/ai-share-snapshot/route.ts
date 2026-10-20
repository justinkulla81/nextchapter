import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { recordAiShareSnapshot } from '@/lib/skills/ai-share-snapshot-server'

export const maxDuration = 300

// Weekly (Mondays): the share of live postings that ask for a specific AI skill, per function
// (src/lib/skills/ai-share-snapshot.ts). Builds the trend behind the public /ai-skills page.
// Rerun-safe: the same week's rows are overwritten.
export const GET = withCronRun('ai-share-snapshot', async () => {
  const result = await recordAiShareSnapshot()
  return NextResponse.json(result)
})
