import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { ukgAdapter } from '@/lib/jobs/gov-ukg-core'

// Jobs of government employers on UKG Pro Recruiting job boards (see GOV_UKG_BOARDS). See runBoardFeed.
export async function runGovUkgFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(ukgAdapter, { listBudgetMs: 40_000, totalBudgetMs: 60_000, maxNew: 400 })
}
