import { listCompetitorAwards, listOpenBoardBids } from '@/lib/bids/queries'
import { BoardBidsView, CompetitorWinsView } from '@/components/admin/BidViews'

// The two bid-finder admin pages, rendered by the same view components with live rows (dev only).
export async function BoardBidsLive() {
  const rows = await listOpenBoardBids().catch(() => [])
  return <div className="mx-auto max-w-4xl p-6"><BoardBidsView rows={rows} missing={false} /></div>
}

export async function CompetitorWinsLive() {
  const rows = await listCompetitorAwards().catch(() => [])
  return <div className="mx-auto max-w-4xl p-6"><CompetitorWinsView rows={rows} missing={false} /></div>
}
