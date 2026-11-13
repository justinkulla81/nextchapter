import { NextResponse } from 'next/server'
import { runCareersInGovFeed } from '@/lib/jobs/careersingov-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-monday). state, county, city and public university jobs from CareersInGovernment onto the job board. See runSitemapFeed.
export const GET = withCronRun('careersingov-feed', async () => {
  const result = await runCareersInGovFeed()
  console.log(`careersingov-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
