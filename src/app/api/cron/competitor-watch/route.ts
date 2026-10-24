import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runWatch } from '@/lib/vision/competitor-watch'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

/**
 * Competitor watch. ?job=refresh (monthly card re-read, 20 cards a run) or ?job=news (weekly news, 25 a run).
 * Metered: does nothing while the master switch on the Competitors page is off, and stops at the monthly cap.
 * Not in vercel.json until Justin has approved the cost.
 */
export const GET = withCronRun('competitor-watch', async (request: NextRequest) => {
  const job = request.nextUrl.searchParams.get('job') === 'news' ? 'news' : 'refresh'
  const r = await runWatch(job, { batch: job === 'news' ? 25 : 20 })
  captureServerEvent('cron', 'competitor_watch_run', { ...r })
  return NextResponse.json(r)
})
