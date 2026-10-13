import { Card, CardContent } from '@/components/ui/card'
import { OCCUPATION_TRENDS_SOURCE } from '@/lib/market/occupation-trends-data'
import { comparePivot, customerServiceNote, type TrendLine } from '@/lib/market/occupation-trends'

const SIGNAL_TEXT = { GROWING: 'Growing', FLAT: 'Flat', SHRINKING: 'Shrinking' } as const
const EXPOSURE_TEXT = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' } as const

function Line({ t }: { t: TrendLine }) {
  return (
    <div className="space-y-1 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">{t.name}</p>
      <p className="text-sm text-foreground">{t.summary}</p>
      <p className="text-xs text-muted-foreground">
        {SIGNAL_TEXT[t.signal]} since 2022. AI task exposure: {EXPOSURE_TEXT[t.exposure].toLowerCase()}.
        {t.smallSample ? ' Small sample, so read it loosely.' : ''}
      </p>
    </div>
  )
}

// Where the work is moving, for people thinking about a pivot. Measured
// numbers from the Displacement Report, never a prediction for one person.
export function OccupationTrendsCard({ currentFunction, targetFunction }: { currentFunction: string | null; targetFunction: string | null }) {
  const { from, to, readout } = comparePivot(currentFunction, targetFunction)
  const showSingle = from.length > 0 && to.length === 0
  if (from.length === 0 && to.length === 0) return null
  const csr = customerServiceNote(currentFunction)

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Where the work is moving</p>
          <p className="text-sm text-muted-foreground">
            What the data shows for the field you are in{to.length > 0 ? ' and the one you are considering' : ''}. These are measured changes, not predictions for you.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {from.slice(0, 1).map((t) => (
            <div key={t.socGroup}>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Where you are</p>
              <Line t={t} />
            </div>
          ))}
          {to.slice(0, 1).map((t) => (
            <div key={t.socGroup}>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Where you are heading</p>
              <Line t={t} />
            </div>
          ))}
        </div>
        {readout && <p className="text-sm text-foreground">{readout}</p>}
        {showSingle && <p className="text-xs text-muted-foreground">Set a target function in Search Strategy to compare.</p>}
        {csr && <p className="text-sm text-muted-foreground">{csr}</p>}
        <p className="text-xs text-muted-foreground">
          Source: {OCCUPATION_TRENDS_SOURCE.title}, {OCCUPATION_TRENDS_SOURCE.edition} (v{OCCUPATION_TRENDS_SOURCE.version}). {OCCUPATION_TRENDS_SOURCE.note}. Occupation groups are broad, so one job can differ from its group.
        </p>
      </CardContent>
    </Card>
  )
}
