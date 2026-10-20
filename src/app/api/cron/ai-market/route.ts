import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildAiMarketSnapshot } from '@/lib/skills/ai-market-live'

export const maxDuration = 300

// Daily AI job market snapshot (src/lib/skills/ai-market-live.ts), after the crawler's import:
// AI-skill and AI-exposed job counts, the AI-skill share and posted-pay premium (raw and
// like-for-like) per function and function x level, and the top AI skills / tools per function.
// Read by the market-size AI line, the Learning page's "AI pays more" note, the admin block and
// the homepage count. Rerun-safe (each run adds a snapshot; readers take the newest).
export const GET = withCronRun('ai-market', async () => {
  const result = await rebuildAiMarketSnapshot()
  return NextResponse.json(result)
})
