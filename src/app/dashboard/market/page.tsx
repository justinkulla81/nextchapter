import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'
import { loadAiAtWork } from '@/lib/skills/ai-at-work'
import { memberMarketTarget } from '@/lib/market/market-size-server'
import { MarketRedesign } from '@/components/market/MarketRedesign'
import { loadNearbyCities } from '@/lib/jobs/widen-strategy-server'

export const metadata: Metadata = { title: 'Your job market' }

// The addressable market: how many jobs fit what and where you're searching,
// whether it's narrow, shrinking or exposed to AI, and opt-in ways to make it
// bigger that feed straight into Find My Job and the daily jobs email.
export default async function MarketPage() {
  const profile = await getDashboardProfile()
  const [m, aiAtWork, nearbyCities] = await Promise.all([
    loadAddressableMarket(profile.id),
    loadAiAtWork(profile.id, memberMarketTarget(profile)?.fn),
    // Cities just across the state line, offered one by one instead of whole neighbouring states.
    loadNearbyCities(profile).catch(() => []),
  ])
  return <MarketRedesign m={m} aiAtWork={aiAtWork} nearbyCities={nearbyCities} />
}
