import { GRADE_TEXT_COLOR, type Grade } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'
import { SAMPLE_CANDIDATE_LABEL, SAMPLE_MARKET_REALITY_PROPS } from '@/lib/marketing/sample-market-reality'

// Same decomposition-tile shape as the real "Where you stand" section on a
// logged-in candidate's own Market Reality Report (market-reality-sections.ts)
// and Stats page, fed with fully invented data for a fictional candidate —
// Partners Master Build Script §C3.1/§C3.2: "proof of the diagnosis... real
// output beats any description," and "no page ships without a real artifact."
export function SampleMarketRealityReport() {
  const { grade, strongestLine, constraintLine, decomposition } = SAMPLE_MARKET_REALITY_PROPS

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sample report — {SAMPLE_CANDIDATE_LABEL}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          Illustrative, not a real person
        </span>
      </div>

      <p className={cn('text-5xl font-bold tabular-nums', GRADE_TEXT_COLOR[grade])}>
        {grade}
        <span className="ml-2 align-middle text-base font-medium text-muted-foreground">Market Reality Grade</span>
      </p>
      <p className="mt-2 text-sm text-foreground">
        {strongestLine} {constraintLine}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {decomposition.map((d) => (
          <div key={d.label} className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{d.label}</p>
            <p className={cn('mt-1 font-semibold tabular-nums', GRADE_TEXT_COLOR[d.grade as Grade])}>{d.grade}</p>
            <p className="mt-1 text-xs text-muted-foreground">{d.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
