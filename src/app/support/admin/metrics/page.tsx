import { requireAdmin } from '@/lib/admin/auth'
import { computePreSeedMetrics } from '@/lib/admin/metrics'
import { MetricsTable } from '@/components/admin/MetricsTable'
import { ProofPointCard } from '@/components/admin/ProofPointCard'

// Headroom against cold starts / transient DB pool contention — this page
// does a real, if now-optimized, full-table computation with no caching.
export const maxDuration = 30

export default async function AdminMetricsPage() {
  await requireAdmin()
  const metrics = await computePreSeedMetrics()

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pre-Seed Metrics</h1>
        <p className="mt-1 text-muted-foreground">
          Investor data-room metrics, computed live from real candidate data. Trend compares
          against this same calculation run 7 days ago.
        </p>
      </div>

      {metrics.proofPoint && <ProofPointCard proofPoint={metrics.proofPoint} />}
      {!metrics.proofPoint && (
        <p className="text-sm text-muted-foreground">
          The investor proof point auto-generates once 50 candidates have reached Week 4 —{' '}
          {metrics.candidatesAtWeek4Plus} so far.
        </p>
      )}

      <MetricsTable title="Funnel" rows={metrics.funnel} />
      <MetricsTable title="Quality" rows={metrics.quality} />
      <MetricsTable title="Market response" rows={metrics.marketResponse} />
      <MetricsTable title="Health" rows={metrics.health} />
      <MetricsTable title="Victoria performance" rows={metrics.victoriaPerformance} />
      <MetricsTable title="Demand testing" rows={metrics.demandTesting} />
    </div>
  )
}
