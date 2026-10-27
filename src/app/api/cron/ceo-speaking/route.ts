import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { syncFromConferences, syncSpeakingTasks } from '@/lib/speaking/sync'
import { captureServerEvent } from '@/lib/posthog/server'

// Daily. Pulls speaker calls that fit the CEO out of the conference catalog, then keeps one to-do per open opportunity.
// No model calls, no email.
export const maxDuration = 120
export const GET = withCronRun('ceo-speaking', async () => {
  const conf = await syncFromConferences()
  const tasks = await syncSpeakingTasks()
  captureServerEvent('cron', 'ceo_speaking_synced', { ...conf, ...tasks })
  return NextResponse.json({ ...conf, ...tasks })
})
