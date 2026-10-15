import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'

// Dashboard: only when the market check flags something (narrow, tied to one
// place, shrinking, AI). Links to the full read and the opt-in expansions.
export async function MarketFlagsCard({ candidateId }: { candidateId: string }) {
  const m = await loadAddressableMarket(candidateId).catch(() => null)
  if (!m || !m.flags.length) return null
  return (
    <section aria-labelledby="mkt-flags" className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <h2 id="mkt-flags" className="flex items-center gap-2 text-base font-semibold">
        <AlertTriangle className="size-4 text-warning" aria-hidden />
        {m.flags[0].title}
      </h2>
      <p className="text-sm text-muted-foreground">{m.flags[0].detail}</p>
      {m.flags.length > 1 && <p className="text-xs text-muted-foreground">Also: {m.flags.slice(1).map((f) => f.title.toLowerCase()).join('; ')}.</p>}
      <Link href="/dashboard/market" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
        See your market and ways to make it bigger
      </Link>
    </section>
  )
}
