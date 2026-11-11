import { NextResponse, type NextRequest } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshFirmListings } from '@/lib/seo/search-firm-pages'
import { firmRefreshAllowed, refreshTopicSnapshots } from '@/lib/seo/topic-snapshot'

export const maxDuration = 300

// Stores the job aggregates behind /industries/<slug> and /functions/<slug> (topic-snapshot.ts). Runs hourly. Each topic is two
// board scans (up to 40 s), and the 07:40-19:40 UTC runs coincided with bursts of job-page query timeouts, so a run refreshes
// snapshots older than 48 h only between 02:00 and 07:59 UTC, and outside that window only those older than 96 h or missing.
// ?trigger=manual refreshes whatever is over 48 h at any hour. A run that has nothing due reads two small tables and stops.
export const GET = withCronRun('topic-snapshots', async (request: NextRequest) => {
  const manual = request.nextUrl.searchParams.get('trigger') === 'manual'
  const result = await refreshTopicSnapshots(180_000, { manual })
  // The search-firm list (a heavy scan) is stored the same way. It is tried at 02:xx and 05:xx UTC only: it failed after ~120 s on
  // most hourly attempts (11-09 and 11-10), each one a wasted heavy read. A page view backstops it at 72 hours.
  const firms = firmRefreshAllowed(Date.now(), manual)
    ? await refreshFirmListings().catch((e) => {
        console.error('Search-firm list refresh failed', e)
        return false
      })
    : false
  return NextResponse.json({ ...result, firmsRefreshed: firms })
}, { recordResult: true })
