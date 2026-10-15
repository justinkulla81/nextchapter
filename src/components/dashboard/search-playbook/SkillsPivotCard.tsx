import { Card, CardContent } from '@/components/ui/card'
import type { MemberPivotResult, PivotPathView } from '@/lib/occupations/corpus'

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`

function Path({ p }: { p: PivotPathView }) {
  const facts: string[] = []
  if (p.medianWage !== null) {
    facts.push(`Median pay ${usd(p.medianWage)}${p.medianIsFloor ? ' or more' : ''}${p.payChangePct !== null ? ` (${signed(p.payChangePct)} on your current occupation)` : ''}`)
  }
  if (p.growthPct !== null) facts.push(`Projected growth ${signed(p.growthPct)}`)
  if (p.annualOpenings !== null) facts.push(`${p.annualOpenings.toLocaleString('en-US')} openings a year`)
  const hasDetail = p.toolsMissing.length > 0 || p.skillGaps.length > 0

  return (
    <div className="space-y-1 rounded-md border border-border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{p.title}</p>
        <p className="shrink-0 text-sm text-foreground">Skills match {p.score}%</p>
      </div>
      {p.toolsHave.length + p.toolsMissing.length > 0 && (
        <p className="text-sm text-foreground">
          Your resume shows {p.toolsHave.length} of the {p.toolsHave.length + p.toolsMissing.length} tools this role lists.
        </p>
      )}
      {facts.length > 0 && <p className="text-xs text-muted-foreground">{facts.join('. ')}.</p>}
      {hasDetail && (
        <details className="pt-1 text-sm">
          <summary className="cursor-pointer text-foreground">What to build for this role</summary>
          <div className="space-y-1 pt-2 text-muted-foreground">
            {p.toolsMissing.length > 0 && <p>Tools it lists that your resume does not show: {p.toolsMissing.join(', ')}.</p>}
            {p.skillGaps.length > 0 && <p>Skills it leans on more than your current occupation does: {p.skillGaps.join(', ')}.</p>}
          </div>
        </details>
      )}
    </div>
  )
}

// Roles a pivoting member's skills carry into, ranked by how closely their current
// occupation's O*NET skills match each role's. A fit measure from public data, never a
// prediction that a move works or that a job is on offer.
export function SkillsPivotCard({ result }: { result: MemberPivotResult | 'error' | null }) {
  // No data imported yet, or the member is not pivoting: nothing to say.
  if (!result || (result !== 'error' && result.status === 'unavailable')) return null

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Roles your skills carry into</p>
          <p className="text-sm text-muted-foreground">
            Ranked by how closely your current occupation&apos;s skills match each role, using public government job data. A high match is not a prediction that you will be hired.
          </p>
        </div>

        {result === 'error' && (
          <p className="text-sm text-muted-foreground">We could not load role matches just now. Reload the page in a minute to try again.</p>
        )}

        {result !== 'error' && result.status === 'unmapped' && (
          <p className="text-sm text-muted-foreground">
            We could not match your latest job title or function to an occupation, so there is nothing to compare yet. Upload your latest resume or confirm your primary function in your profile to see matches.
          </p>
        )}

        {result !== 'error' && result.status === 'ok' && (
          <>
            <p className="text-xs text-muted-foreground">
              Based on {result.current.basis === 'title' ? 'your latest job title' : 'your primary function'}, matched to {result.current.title}.
            </p>
            {result.considering && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">The role you are considering</p>
                <Path p={result.considering} />
              </div>
            )}
            {result.paths.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Closest matches</p>
                {result.paths.slice(0, 5).map((p) => (
                  <Path key={p.socCode} p={p} />
                ))}
              </div>
            ) : (
              !result.considering && <p className="text-sm text-muted-foreground">No other role matches your skills closely enough to suggest yet.</p>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Skills and tools from O*NET (U.S. Department of Labor, CC BY 4.0). Pay and growth from the Bureau of Labor Statistics. Pay is the national median for the occupation, and the highest-paid roles are reported only as a floor.
        </p>
      </CardContent>
    </Card>
  )
}
