import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { csodAdapter } from '@/lib/jobs/gov-csod-core'

// Jobs of government employers on Cornerstone career sites (the Commonwealth of Kentucky). See runBoardFeed.
export async function runGovCsodFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(csodAdapter, { listBudgetMs: 30_000, totalBudgetMs: 40_000, maxNew: 400 })
}
