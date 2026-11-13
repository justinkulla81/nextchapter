import { NextResponse } from 'next/server'
import { runGovKepsFeed } from '@/lib/jobs/gov-keps-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). Kentucky school district vacancies from KEPS, onto the job board.
export const GET = withCronRun('gov-keps-feed', async () => {
  const result = await runGovKepsFeed()
  console.log(`gov-keps-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
