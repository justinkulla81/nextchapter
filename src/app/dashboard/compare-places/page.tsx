import { redirect } from 'next/navigation'
import { compareHref, type Lens } from '@/lib/workforce/metro-compare'

// Compare places is now the "Compare job markets" tab of Your move plan. Old links and saved comparisons keep working.
export default async function ComparePlacesPage({ searchParams }: { searchParams: Promise<{ m?: string; lens?: string }> }) {
  const { m, lens } = await searchParams
  const params = new URLSearchParams({ tab: 'compare' })
  if (m) params.set('m', m)
  if (lens === 'life') params.set('lens', 'life' satisfies Lens)
  redirect(`/dashboard/move-plan?${params.toString()}`)
}
