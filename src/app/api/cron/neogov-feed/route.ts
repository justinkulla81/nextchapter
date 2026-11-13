import { NextResponse } from 'next/server'
import { runNeogovFeed } from '@/lib/jobs/neogov-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-monday). Keeps the government jobs from NEOGOV on the job board current: re-confirms jobs still
// listed, archives the ones that closed, and adds new professional and management jobs. See runNeogovFeed.
export const GET = withCronRun('neogov-feed', async () => {
  const result = await runNeogovFeed()
  console.log(`neogov-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
