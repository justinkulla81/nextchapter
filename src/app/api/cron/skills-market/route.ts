import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildSkillsMarketSnapshot } from '@/lib/skills/market-server'

export const maxDuration = 300

// Daily skills market snapshot (src/lib/skills/market-server.ts), after the crawler's import: the skills live postings
// name, by industry, function, state and level, with the AI exposure and AI-pairing of each. Read by /skills.
// Rerun-safe (each run adds a snapshot; readers take the newest).
export const GET = withCronRun('skills-market', async () => {
  const result = await rebuildSkillsMarketSnapshot()
  return NextResponse.json(result)
})
