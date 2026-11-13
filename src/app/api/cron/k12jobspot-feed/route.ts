import { NextResponse } from 'next/server'
import { runK12JobSpotFeed } from '@/lib/jobs/k12jobspot-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-monday). Public school district jobs from K12JobSpot onto the job board. See runSitemapFeed.
export const GET = withCronRun('k12jobspot-feed', async () => {
  const result = await runK12JobSpotFeed()
  console.log(`k12jobspot-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
