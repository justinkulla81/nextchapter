import { getDemandCount, isAdzunaInsightsEnabled } from '@/lib/market/adzuna-insights'

// Postings advertised right now for this occupation, from the shared Adzuna cache.
// On a cold cache we fill it in the background rather than make the page wait, so the
// first visit says so and the number shows on the next one. Render inside <Suspense>.
export async function LocalDemand({ title, state, stateLabel }: { title: string; state: string | null; stateLabel: string }) {
  if (!isAdzunaInsightsEnabled()) return null
  const role = title.split(',')[0]
  const result = await getDemandCount({ role, state }, { onMiss: 'background' })
  if (!result.data) {
    return <p className="text-xs text-muted-foreground">Local openings: we are gathering this now. Check back tomorrow.</p>
  }
  const where = state ? stateLabel : 'across the US'
  return (
    <p className="text-xs text-muted-foreground">
      About <span className="font-medium text-foreground">{result.data.count.toLocaleString('en-US')}</span> openings advertised {where}. This is a keyword search of job ads, so read it as a rough guide.
    </p>
  )
}
