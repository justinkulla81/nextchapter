import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadWidenStrategy } from '@/lib/jobs/widen-strategy-server'
import { WidenStrategyFlow } from '@/components/dashboard/widen/WidenStrategyFlow'

export const metadata: Metadata = { title: 'Widen your search' }

// Widen your search: the strategy a member builds before the board looks past home (widen-strategy.ts). Reached from
// the board's Broader / Everything switch the first time, and from "Change your strategy" after.
export default async function WidenSearchPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [profile, params] = await Promise.all([getDashboardProfile(), searchParams])
  const view = await loadWidenStrategy(profile)
  const from = params.from === 'board' ? 'board' : 'direct'
  return <WidenStrategyFlow view={view} from={from} />
}
