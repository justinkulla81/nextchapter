import { NextResponse } from 'next/server'
import { runFloridaStateFeed } from '@/lib/jobs/gov-florida-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs). State of Florida agency jobs from jobs.myflorida.com, onto the job board.
export const GET = withCronRun('florida-state-feed', async () => {
  const result = await runFloridaStateFeed()
  console.log(`florida-state-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
