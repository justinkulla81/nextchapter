// Expected pay change for a career pivot. Two paths per pivot:
//   KEEP_SENIORITY - adjacent role at the same level
//   RESET          - larger pivot, expect to re-enter at a lower level
// Estimates are ranges with a stated basis and confidence, never a point
// number. Benchmarks live in PayChangeBenchmark rows (each with a source); when
// no matching row exists we say so instead of guessing.

export type PivotPathType = 'KEEP_SENIORITY' | 'RESET'
export type PayDeltaConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export interface PayBenchmarkRow {
  pathType: PivotPathType
  group: string // e.g. 'long-tenured laid-off workers', 'occupation switchers'
  lowPct: number // plausible low end of pay change, e.g. -25
  highPct: number // plausible high end, e.g. 5
  medianPct: number | null
  sampleSize: number | null
  confidence: PayDeltaConfidence
  sourceTitle: string
  sourceUrl: string | null
  asOf: string | null
}

export interface PayChangeEstimate {
  pathType: PivotPathType
  available: boolean
  lowPct: number | null
  highPct: number | null
  confidence: PayDeltaConfidence | null
  basis: string
}

export function estimatePayChange(pathType: PivotPathType, rows: PayBenchmarkRow[]): PayChangeEstimate {
  const matching = rows.filter((r) => r.pathType === pathType)
  if (matching.length === 0) {
    return {
      pathType,
      available: false,
      lowPct: null,
      highPct: null,
      confidence: null,
      basis: 'No benchmark available for this path yet. We will not guess a number.',
    }
  }
  // Use the most conservative envelope across matching benchmarks (lowest low,
  // lowest high) so we never overpromise.
  const lowPct = Math.min(...matching.map((r) => r.lowPct))
  const highPct = Math.min(...matching.map((r) => r.highPct))
  const order: Record<PayDeltaConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }
  const confidence = matching.reduce<PayDeltaConfidence>((acc, r) => (order[r.confidence] < order[acc] ? r.confidence : acc), 'HIGH')
  const basis = matching.map((r) => `${r.group} (${r.sourceTitle}${r.asOf ? `, ${r.asOf}` : ''})`).join('; ')
  return { pathType, available: true, lowPct, highPct, confidence, basis }
}

export function describePayRange(e: PayChangeEstimate): string {
  if (!e.available || e.lowPct === null || e.highPct === null) return 'Pay change: not enough data to estimate.'
  const fmt = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`
  return `Typical pay change: ${fmt(e.lowPct)} to ${fmt(e.highPct)} (${e.confidence?.toLowerCase()} confidence).`
}
