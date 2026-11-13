import { NextResponse } from 'next/server'
import { runEdjoinFeed } from '@/lib/jobs/edjoin-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-monday). California school and college jobs from EdJoin onto the job board. See runSitemapFeed.
export const GET = withCronRun('edjoin-feed', async () => {
  const result = await runEdjoinFeed()
  console.log(`edjoin-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
