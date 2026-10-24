import { requireAdmin } from '@/lib/admin/auth'
import { listOpenBoardBids } from '@/lib/bids/queries'
import { BoardBidsView } from '@/components/admin/BidViews'

export const maxDuration = 30

/** Open bids found on workforce boards' own procurement pages (read weekly, one request at a time). */
export default async function BoardBidsPage() {
  await requireAdmin()
  let rows: Awaited<ReturnType<typeof listOpenBoardBids>> = []
  let missing = false
  try {
    rows = await listOpenBoardBids()
  } catch {
    missing = true
  }
  return <BoardBidsView rows={rows} missing={missing} />
}
