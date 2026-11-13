import { NextResponse } from 'next/server'
import { runGovWorkdayFeed } from '@/lib/jobs/gov-workday-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs). Jobs of government employers on their own Workday career sites onto the job board.
export const GET = withCronRun('gov-workday-feed', async () => {
  const result = await runGovWorkdayFeed()
  console.log(`gov-workday-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
