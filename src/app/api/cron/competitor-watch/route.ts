import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { runWatchByMode } from '@/lib/vision/competitor-free'
import { prisma } from '@/lib/prisma'
import { syncCrmWins, syncGapsFor, syncRebidOpportunities } from '@/lib/vision/competitor-sync'
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
  // Pass the findings on: wins to CRM notes and re-bid dates, new gaps to the product list. Idempotent; only when the watch is on.
  let synced = { wins: 0, ideas: 0 }
  if (!r.skipped) {
    try {
      const cards = await prisma.productCompetitor.findMany({ where: { status: 'ACTIVE' } })
      synced = { wins: await syncCrmWins(cards), ideas: 0 }
      await syncRebidOpportunities(cards)
      synced.ideas = (await syncGapsFor(cards, 3, 25)).created // at most 25 new gaps a run, one model call, so the roadmap is not flooded
    } catch (e) { console.error('Competitor watch sync failed', e) }
  }
  captureServerEvent('cron', 'competitor_watch_run', { ...r, ...synced })
  return NextResponse.json({ ...r, synced })
})
