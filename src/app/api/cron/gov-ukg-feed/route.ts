import { NextResponse } from 'next/server'
import { runGovUkgFeed } from '@/lib/jobs/gov-ukg-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). Government employers on UKG Pro Recruiting job boards, onto the job board.
export const GET = withCronRun('gov-ukg-feed', async () => {
  const result = await runGovUkgFeed()
  console.log(`gov-ukg-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
