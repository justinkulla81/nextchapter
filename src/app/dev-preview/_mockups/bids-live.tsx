import { listCompetitorAwards, listOpenBoardBids, loadCrossRefs } from '@/lib/bids/queries'
import { BoardBidsView, CompetitorWinsView } from '@/components/admin/BidViews'

// The two bid-finder admin pages, rendered by the same view components with live rows (dev only).
export async function BoardBidsLive() {
  const rows = await listOpenBoardBids().catch(() => [])
  const ctx = await loadCrossRefs(await listCompetitorAwards({ limit: 1500 }).catch(() => []), rows).catch(() => null)
  return <div className="mx-auto max-w-4xl p-6"><BoardBidsView rows={rows} missing={false} refs={ctx?.refs} /></div>
}

export async function CompetitorWinsLive() {
  const rows = await listCompetitorAwards().catch(() => [])
  const ctx = await loadCrossRefs(rows, await listOpenBoardBids().catch(() => [])).catch(() => null)
  return <div className="mx-auto max-w-4xl p-6"><CompetitorWinsView rows={rows} missing={false} refs={ctx?.refs} cardIds={ctx?.cardIds} /></div>
}
