import 'server-only'
import { runBoardFeed, type BoardFeedResult } from '@/lib/jobs/gov-board-feed'
import { workdayAdapter } from '@/lib/jobs/gov-workday-core'

// Jobs of government employers that run their own Workday career site (county, city, state, school district, public
// university and public authority; see gov-workday-boards.ts). See runBoardFeed for what a run does.
export async function runGovWorkdayFeed(): Promise<BoardFeedResult> {
  return runBoardFeed(workdayAdapter, { listBudgetMs: 60_000, totalBudgetMs: 110_000, maxNew: 600 })
}
