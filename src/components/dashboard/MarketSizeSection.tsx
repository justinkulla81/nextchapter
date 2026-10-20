import type { CandidateProfile } from '@prisma/client'
import { loadMarketSize } from '@/lib/market/market-size-server'
import { marketTierFor } from '@/lib/jobs/relevance'
import { computeMatchState } from '@/lib/personalization/match-compute'
import { MarketSizeBlock } from '@/components/dashboard/MarketSizeBlock'
import { loadAiMarket } from '@/lib/skills/ai-market-live'

/** Loads the member's market size and shows the block; nothing when there's no target or no stats yet. Wrap in Suspense. */
export async function MarketSizeSection({
  member,
  surface,
  searchCount,
  searchQuery,
}: {
  member: CandidateProfile
  surface: 'board_search' | 'search_strategy' | 'market_reality'
  searchCount?: number
  searchQuery?: string
}) {
  // Their own numbers are the strict relevant count (relevance.ts) and the strong fits among it,
  // from the same run the board's "What we know about you" and the retune use — so they move as the profile sharpens.
  const state = await computeMatchState(member, { live: true }).catch(() => null)
  const relevant = state ? { count: state.counts.matches, strong: state.counts.strong, tier: marketTierFor(state.counts.matches).key } : undefined
  const [view, aiMarket] = await Promise.all([
    loadMarketSize(member, relevant).catch((error) => {
      console.error('Market size unavailable:', error)
      return null
    }),
    loadAiMarket(),
  ])
  if (!view) return null
  return <MarketSizeBlock view={view} surface={surface} searchCount={searchCount} searchQuery={searchQuery} aiMarket={aiMarket} />
}
