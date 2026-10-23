import { prisma } from '@/lib/prisma'
import { describePayRange, estimatePayChange, type PayBenchmarkRow, type PivotPathType } from '@/lib/outcomes/pay-change-estimate'
import { REFERENCE_STATS } from '@/lib/outcomes/benchmark-seed-data'

const PATHS: { type: PivotPathType; title: string; blurb: string }[] = [
  { type: 'KEEP_SENIORITY', title: 'Keep your level', blurb: 'A neighboring role at about the same level, using most of what you already do.' },
  { type: 'RESET', title: 'Bigger change', blurb: 'A different field where you may re-enter at a lower level and grow from there.' },
]

// What a career change may do to pay, as a range with its sources. Shows "not
// enough data" rather than a guess when no sourced benchmark exists.
export async function PayChangeCard() {
  const rows = await prisma.payChangeBenchmark.findMany({ orderBy: { createdAt: 'asc' } })
  const bench: PayBenchmarkRow[] = rows.map((r) => ({
    pathType: r.pathType,
    group: r.group,
    lowPct: r.lowPct,
    highPct: r.highPct,
    medianPct: r.medianPct,
    sampleSize: r.sampleSize,
    confidence: r.confidence,
    sourceTitle: r.sourceTitle,
    sourceUrl: r.sourceUrl,
    asOf: r.asOf,
  }))

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">What a career change may do to your pay</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Among full-time workers who lost a job in 2023 to 2025 who found work again, about {REFERENCE_STATS.fullTimeReemployedEarningAsMuchOrMorePct}% earn as much or
          more than before, which means about half earn less. Pay depends heavily on field, level and how you are hired, so treat the ranges
          below as a starting point, not a prediction.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PATHS.map((p) => {
          const e = estimatePayChange(p.type, bench)
          return (
            <div key={p.type} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.blurb}</p>
              <p className="mt-2 text-sm text-foreground">{describePayRange(e)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Basis: {e.basis}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Source for the full-time figure: {REFERENCE_STATS.source}. Ranges come from published studies of workers who lost jobs and career changers and are
        marked low confidence until verified against the originals.
      </p>
    </div>
  )
}
