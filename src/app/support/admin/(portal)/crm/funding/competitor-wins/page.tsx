import { requireAdmin } from '@/lib/admin/auth'
import { listCompetitorAwards, listOpenBoardBids, loadCrossRefs } from '@/lib/bids/queries'
import { CompetitorWinsView } from '@/components/admin/BidViews'

export const maxDuration = 30

/** Federal contracts and grants won by competitors (USAspending.gov), grouped per competitor. */
export default async function CompetitorWinsPage() {
  await requireAdmin()
  let rows: Awaited<ReturnType<typeof listCompetitorAwards>> = []
  let missing = false
  try {
    rows = await listCompetitorAwards()
  } catch {
    missing = true
  }
  const ctx = missing ? null : await loadCrossRefs(rows, await listOpenBoardBids().catch(() => [])).catch(() => null)
  return <CompetitorWinsView rows={rows} missing={missing} refs={ctx?.refs} cardIds={ctx?.cardIds} />
}
