import { NextRequest, NextResponse } from 'next/server'
import { ingestLikelyOpenings } from '@/lib/likely-openings/ingest'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 300

/**
 * Daily "likely openings" pull from SEC EDGAR (free): 8-K Item 5.02 officer
 * departures/appointments and Form D raises of $10M+ at operating companies.
 * Looks back 4 calendar days so a late-indexed filing or a missed run is
 * caught; stored filings are never re-fetched. ?days=N widens the window
 * (the 60-day backfill runs from scripts/backfill-likely-openings.ts, which
 * has no time limit).
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 4))
  const stats = await ingestLikelyOpenings({
    days,
    deadline: Date.now() + 270_000,
    log: (m) => console.log(`likely-openings: ${m}`),
  })
  captureServerEvent('cron', 'likely_openings_ingest_run', {
    days,
    created: stats.created,
    eightK502: stats.eightK502,
    formDFetched: stats.formDFetched,
    errors: stats.errors,
    stoppedEarly: stats.stoppedEarly,
  })
  return NextResponse.json(stats)
}
