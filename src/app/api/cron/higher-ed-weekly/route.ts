import { NextResponse } from 'next/server'
import { sendWeeklyDigests } from '@/lib/higher-ed/inbox'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

// Monday morning: one email per college office with what's waiting for it.
export const GET = withCronRun('higher-ed-weekly', async () => {
  const result = await sendWeeklyDigests()
  captureServerEvent('cron', 'he_weekly_digest_sent', result)
  return NextResponse.json({ ok: true, ...result })
})
