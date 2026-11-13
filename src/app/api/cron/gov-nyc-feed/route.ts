import { NextResponse } from 'next/server'
import { runGovNycFeed } from '@/lib/jobs/gov-nyc-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). New York City government jobs from NYC Open Data, onto the job board.
export const GET = withCronRun('gov-nyc-feed', async () => {
  const result = await runGovNycFeed()
  console.log(`gov-nyc-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
