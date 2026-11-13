import { NextResponse } from 'next/server'
import { runGovOracleFeed } from '@/lib/jobs/gov-oracle-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs). Jobs of government employers on their own Oracle Recruiting Cloud sites onto the job board.
export const GET = withCronRun('gov-oracle-feed', async () => {
  const result = await runGovOracleFeed()
  console.log(`gov-oracle-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
