import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CONFIDENCE_STYLE, type ConfidenceLevel } from '@/lib/scoring/grade'
import type { DimensionSummary } from '@/lib/references/aggregate-performance'
import type { RequiredMixStatus } from '@/lib/references/required-mix'

// Summary card shown above the requested/provided lists — the aggregation
// view (spec §5.8) and the required-mix nudge (§5.1) live here, both built
// from server-computed data, no client state needed.
export function ReferenceCheckSummary({
  dimensions,
  completedReferenceCount,
  confidenceTier,
  mix,
}: {
  dimensions: DimensionSummary[]
  completedReferenceCount: number
  confidenceTier: ConfidenceLevel
  mix: RequiredMixStatus
}) {
  if (completedReferenceCount === 0) return null

  // Provisional (1-2 responses) shows written answers and verification
  // only, per spec §5.8 — no dimension averages or comparative panel yet.
  const showDimensions = confidenceTier !== 'PROVISIONAL'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Performance summary</CardTitle>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', CONFIDENCE_STYLE[confidenceTier])}>
            {completedReferenceCount} response{completedReferenceCount === 1 ? '' : 's'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showDimensions ? (
          <div className="space-y-2">
            {dimensions.map((d) => (
              <div key={d.dimension} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{d.dimension}</span>
                <span className="text-muted-foreground">
                  {d.label ? `${d.label} (${d.n})` : 'No responses yet'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re at {completedReferenceCount} response{completedReferenceCount === 1 ? '' : 's'} — 3 or more
            unlocks performance averages here; 5 or more unlocks the full comparative view.
          </p>
        )}

        {!mix.satisfied && (
          <div className="space-y-1.5 border-t border-border pt-3 text-sm">
            <p className="font-medium text-foreground">A well-rounded set includes:</p>
            <MixRow label="A former manager" done={mix.hasManager} />
            <MixRow label="A peer" done={mix.hasPeer} />
            <MixRow label="A direct report or client" done={mix.hasReportOrClient} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MixRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', done ? 'text-success' : 'text-muted-foreground')}>
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success/10' : 'border-border'
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      {label}
    </div>
  )
}
