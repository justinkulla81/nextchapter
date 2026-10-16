import { loadMarketSize, type MarketMember } from '@/lib/market/market-size-server'
import { MarketSizeBlock } from '@/components/dashboard/MarketSizeBlock'

/** Loads the member's market size and shows the block; nothing when there's no target or no stats yet. Wrap in Suspense. */
export async function MarketSizeSection({
  member,
  surface,
  searchCount,
  searchQuery,
}: {
  member: MarketMember
  surface: 'board_search' | 'search_strategy' | 'market_reality'
  searchCount?: number
  searchQuery?: string
}) {
  const view = await loadMarketSize(member).catch((error) => {
    console.error('Market size unavailable:', error)
    return null
  })
  if (!view) return null
  return <MarketSizeBlock view={view} surface={surface} searchCount={searchCount} searchQuery={searchQuery} />
}
