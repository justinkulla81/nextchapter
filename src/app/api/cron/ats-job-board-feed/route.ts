import { NextResponse, type NextRequest } from 'next/server'
import { runAtsJobBoardFeed } from '@/lib/jobs/ats-job-board-feed'

export const maxDuration = 120

// Fires daily. Pulls fresh listings directly from each curated company's
// own ATS board (see src/lib/market/ats-companies.ts) into the NC Job Board
// review queue — see runAtsJobBoardFeed for why every row lands as
// 'pending' with no named contact.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runAtsJobBoardFeed()
  return NextResponse.json(result)
}
