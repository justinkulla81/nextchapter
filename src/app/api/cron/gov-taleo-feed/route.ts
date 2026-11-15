import { NextResponse } from 'next/server'
import { runGovTaleoFeed } from '@/lib/jobs/gov-taleo-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). Government employers on Taleo Business Edition career sites, onto the job board.
export const GET = withCronRun('gov-taleo-feed', async () => {
  const result = await runGovTaleoFeed()
  console.log(`gov-taleo-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
