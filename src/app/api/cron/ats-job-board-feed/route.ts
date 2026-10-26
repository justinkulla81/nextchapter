import { NextResponse } from 'next/server'
import { runAtsJobBoardFeed } from '@/lib/jobs/ats-job-board-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 120

// Fires daily. Pulls fresh listings directly from each curated company's
// own ATS board (see src/lib/market/ats-companies.ts) into the NC Job Board
// review queue — see runAtsJobBoardFeed for why every row lands as
// 'pending' with no named contact.
export const GET = withCronRun('ats-job-board-feed', async () => {
  const result = await runAtsJobBoardFeed()
  // The counts (including usajobsFetched) otherwise only exist in the response body.
  console.log(`ats-job-board-feed: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
