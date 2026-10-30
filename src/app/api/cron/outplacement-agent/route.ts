import { NextResponse } from 'next/server'
import { runOutplacementAgentWeek } from '@/lib/outplacement-agent/run'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Mondays: the outplacement agent's weekly plan and drafted notes for each activated seat. Does nothing while OUTPLACEMENT_AGENT_ENABLED is off.
export const GET = withCronRun('outplacement-agent', async () => {
  return NextResponse.json({ ok: true, ...(await runOutplacementAgentWeek()) })
})
