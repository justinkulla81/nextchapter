type Part = { key: string; label: string; points: number; max: number; note: string; known: boolean }
export type FitBreakdown = { coverage?: number; parts?: Part[] } | null

/**
 * An internal fit score (0-100, see src/lib/geo/partner-scoring.ts) with the
 * reason for it in the tooltip. A contact in the CRM adds to it outside the 100,
 * so the number can read above 100.
 */
export function FitScoreBadge({ score, breakdown }: { score: number | null | undefined; breakdown?: FitBreakdown }) {
  if (score == null) return <span className="text-muted-foreground">—</span>
  const parts = breakdown?.parts ?? []
  const why = parts
    .map((p) => `${p.label}: ${p.max ? `${p.points}/${p.max}` : `+${p.points}`} — ${p.note}${p.known ? '' : ' (not known, scored neutral)'}`)
    .join('\n')
  const tone = score >= 75 ? 'bg-success/15 text-success' : score >= 55 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`} title={why || 'Internal fit score'}>
      {Math.round(score)}
    </span>
  )
}
