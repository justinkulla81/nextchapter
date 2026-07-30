import { requireAdmin } from '@/lib/admin/auth'
import { computePreSeedMetrics } from '@/lib/admin/metrics'
import { computeStructuralCorrelation } from '@/lib/admin/structural-correlation'
import { MetricsTable } from '@/components/admin/MetricsTable'
import { ProofPointCard } from '@/components/admin/ProofPointCard'
import { StructuralCorrelationTable } from '@/components/admin/StructuralCorrelationTable'

// Headroom against cold starts / transient DB pool contention — this page
// does a real, if now-optimized, full-table computation with no caching.
export const maxDuration = 30

export default async function AdminMetricsPage() {
  await requireAdmin()
  const [metrics, structuralCorrelation] = await Promise.all([computePreSeedMetrics(), computeStructuralCorrelation()])

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site Metrics</h1>
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

      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Structural signal correlation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Do job-hopping, career trajectory, and education actually correlate with real hiring
            outcomes (an offer-letter-backed Offer Bonus claim, not self-reported)?
          </p>
        </div>
        {Object.entries(structuralCorrelation).map(([title, rows]) => (
          <StructuralCorrelationTable key={title} title={title} rows={rows} />
        ))}
      </div>
    </div>
  )
}
