import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { kepsAdapter } from '@/lib/jobs/gov-keps-core'

// Weekly run for the keps government job source. See runBoardFeed.
export async function runGovKepsFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(kepsAdapter, { listBudgetMs: 40_000, totalBudgetMs: 70_000, maxNew: 600 })
}
