import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { taleoAdapter } from '@/lib/jobs/gov-taleo-core'

// Weekly run for the taleo government job source. See runBoardFeed.
export async function runGovTaleoFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(taleoAdapter, { listBudgetMs: 40_000, totalBudgetMs: 70_000, maxNew: 600 })
}
