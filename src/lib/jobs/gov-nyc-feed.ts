import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { nycAdapter } from '@/lib/jobs/gov-nyc-core'

// Weekly run for the nyc government job source. See runBoardFeed.
export async function runGovNycFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(nycAdapter, { listBudgetMs: 40_000, totalBudgetMs: 70_000, maxNew: 600 })
}
