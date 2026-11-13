import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { oracleAdapter } from '@/lib/jobs/gov-oracle-core'

// Jobs of government employers that run their own Oracle Recruiting Cloud career site (see gov-oracle-boards.ts).
// See runBoardFeed for what a run does.
export async function runGovOracleFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(oracleAdapter, { listBudgetMs: 30_000, totalBudgetMs: 80_000, maxNew: 400 })
}
