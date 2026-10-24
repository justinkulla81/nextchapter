import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runWatchByMode } from '@/lib/vision/competitor-free'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

/**
 * Competitor watch. ?job=refresh (monthly card re-read, 20 cards a run) or ?job=news (monthly news, 25 a run).
 * Metered: does nothing while the master switch on the Competitors page is off, and stops at the monthly cap.
 * Scheduled monthly in vercel.json (each card is due once every 30 days; the daily runs on the first days of the month work through the due cards). Stays off until the master switch is turned on.
 */
export const GET = withCronRun('competitor-watch', async (request: NextRequest) => {
  const job = request.nextUrl.searchParams.get('job') === 'news' ? 'news' : 'refresh'
  const r = await runWatchByMode(job)
  captureServerEvent('cron', 'competitor_watch_run', { ...r })
  return NextResponse.json(r)
})
