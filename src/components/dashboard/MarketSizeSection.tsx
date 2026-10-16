import { loadMarketSize, type MarketMember } from '@/lib/market/market-size-server'
import { loadBoardShortlist } from '@/lib/jobs/board-shortlist'
import { MarketSizeBlock } from '@/components/dashboard/MarketSizeBlock'

/** Loads the member's market size and shows the block; nothing when there's no target or no stats yet. Wrap in Suspense. */
export async function MarketSizeSection({
  member,
  surface,
  searchCount,
  searchQuery,
}: {
  member: MarketMember & Parameters<typeof loadBoardShortlist>[0]['candidate']
  surface: 'board_search' | 'search_strategy' | 'market_reality'
  searchCount?: number
  searchQuery?: string
}) {
  // Their own count is the strict relevant one (relevance.ts), from the same board the job list uses.
  const board = await loadBoardShortlist({ candidate: member, isCandidatePlus: true, size: 1, includeMidLevel: true, includeEarlyCareer: true, breadth: 'narrow' }).catch(() => null)
  const relevant = board?.breadth.classifier ? { count: board.breadth.relevantTotal, tier: board.breadth.marketTier } : undefined
  const view = await loadMarketSize(member, relevant).catch((error) => {
    console.error('Market size unavailable:', error)
    return null
  })
  if (!view) return null
  return <MarketSizeBlock view={view} surface={surface} searchCount={searchCount} searchQuery={searchQuery} />
}
