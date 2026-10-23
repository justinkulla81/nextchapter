import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'
import { loadAiAtWork } from '@/lib/skills/ai-at-work'
import { memberMarketTarget } from '@/lib/market/market-size-server'
import { MarketRedesign } from '@/components/market/MarketRedesign'

export const metadata: Metadata = { title: 'Your job market' }

// The addressable market: how many jobs fit what and where you're searching,
// whether it's narrow, shrinking or exposed to AI, and opt-in ways to make it
// bigger that feed straight into Find My Job and the daily jobs email.
export default async function MarketPage() {
  const profile = await getDashboardProfile()
  const m = await loadAddressableMarket(profile.id)
  const aiAtWork = await loadAiAtWork(profile.id, memberMarketTarget(profile)?.fn)
  return <MarketRedesign m={m} aiAtWork={aiAtWork} />
}
