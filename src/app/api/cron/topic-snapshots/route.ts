import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { refreshFirmListings } from '@/lib/seo/search-firm-pages'
import { refreshTopicSnapshots } from '@/lib/seo/topic-snapshot'

export const maxDuration = 300

// Stores the job aggregates behind /industries/<slug> and /functions/<slug> (topic-snapshot.ts). Runs every 10 minutes
// and does nothing once every snapshot is under 23 hours old; after a deploy or a long gap it works through the stalest
// topics one at a time, stopping with a margin before the function limit.
export const GET = withCronRun('topic-snapshots', async () => {
  const result = await refreshTopicSnapshots(150_000)
  // The search-firm list (a heavy scan) is stored the same way and refreshed here once a day.
  const firms = await refreshFirmListings().catch((e) => {
    console.error('Search-firm list refresh failed', e)
    return false
  })
  return NextResponse.json({ ...result, firmsRefreshed: firms })
})
