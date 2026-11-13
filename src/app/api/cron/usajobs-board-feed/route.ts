import { NextResponse } from 'next/server'
import { runUsajobsBoardFeed } from '@/lib/jobs/usajobs-board-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-monday). Federal jobs from USAJOBS's keyless Historic JOA API onto the job board.
export const GET = withCronRun('usajobs-board-feed', async () => {
  const result = await runUsajobsBoardFeed()
  console.log(`usajobs-board-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
