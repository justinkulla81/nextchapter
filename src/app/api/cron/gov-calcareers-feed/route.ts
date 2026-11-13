import { NextResponse } from 'next/server'
import { runCalCareersFeed } from '@/lib/jobs/gov-calcareers-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). State of California jobs from CalCareers, onto the job board.
export const GET = withCronRun('gov-calcareers-feed', async () => {
  const result = await runCalCareersFeed()
  console.log(`gov-calcareers-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
