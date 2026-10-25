import { NextResponse, type NextRequest } from 'next/server'
import { crawlBoardBids } from '@/lib/bids/board-crawl'
import { fileBidsToCrm } from '@/lib/bids/crm-filing'
import { captureServerEvent } from '@/lib/posthog/server'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily slice of the weekly board-bid crawl: reads the stalest workforce boards' own procurement pages,
// one request at a time (no AI, no paid API), and stores the bids on them. ?dryRun=1 reads and reports
// without writing; ?boards=KY-243,PA-512 reads just those, even if read recently.
export const GET = withCronRun('board-bids', async (request: NextRequest) => {
  const p = request.nextUrl.searchParams
  const boards = p.get('boards')?.split(',').map((s) => s.trim()).filter(Boolean)
  const result = await crawlBoardBids({ deadlineMs: 200_000, dryRun: p.get('dryRun') === '1', boardIds: boards, force: !!boards })
  // Then file what fits on each board's CRM organization (not on a dry run).
  const crm = p.get('dryRun') === '1' ? null : await fileBidsToCrm({ deadlineMs: 40_000 }).catch((e) => ({ error: String(e).slice(0, 200) }))
  captureServerEvent('cron', 'board_bids_crawled', { read: result.read, withBids: result.withBids, newBids: result.newBids, blocked: result.blocked, unreachable: result.unreachable, crmFiled: crm && 'filed' in crm ? crm.filed : 0 })
  return NextResponse.json({ ...result, crm })
})
