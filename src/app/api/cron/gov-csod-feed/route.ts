import { NextResponse } from 'next/server'
import { runGovCsodFeed } from '@/lib/jobs/gov-csod-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs). Jobs of government employers on Cornerstone career sites (the Commonwealth of Kentucky), onto the job board.
export const GET = withCronRun('gov-csod-feed', async () => {
  const result = await runGovCsodFeed()
  console.log(`gov-csod-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
