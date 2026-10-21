import { Card, CardContent } from '@/components/ui/card'
import { PivotPathImpression } from '@/components/dashboard/pivot/PivotPathImpression'
import { PivotRoleDetail } from '@/components/dashboard/pivot/PivotRoleDetail'
import type { PivotOption } from '@/lib/careers/pivots'
import { bandFromOverlap, SKILLS_FIT_LABEL } from '@/lib/careers/skills-fit'

// Candidates are shown bands, never precise-looking scores, so the share of skills in common is
// reduced to four steps.
const BAND_STEP = { few: 0, partial: 1, good: 2, close: 3 } as const
function bandFor(overlap: number): { step: number; label: string } {
  const band = bandFromOverlap(overlap)
  return { step: BAND_STEP[band], label: `${SKILLS_FIT_LABEL[band]} with your current work` }
}

// A role found by skills alone (O*NET and BLS), shown below the market-ranked pivot paths.
export function PivotOptionCard({
  option,
  state,
  stateLabel,
  stateCode,
  tasks,
  fromSoc,
  rank,
  currentTarget,
}: {
  option: PivotOption
  state: string | null
  stateLabel: string
  stateCode: string | null
  tasks: string[]
  fromSoc: string
  rank: number
  currentTarget: string | null
}) {
  const overlapBand = option.overlap === null ? null : bandFor(option.overlap)

  return (
    <PivotPathImpression fromSoc={fromSoc} toSoc={option.socCode} similarity={option.similarity} rank={rank} payBasis={option.payBasis}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
              {option.onetRelated && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Listed as related by O*NET</span>
              )}
            </div>
            {overlapBand && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1" role="img" aria-label={overlapBand.label}>
                  {[0, 1, 2, 3].map((step) => (
                    <span key={step} className={`h-2 w-8 rounded-full ${step <= overlapBand.step ? 'bg-foreground' : 'bg-muted'}`} />
                  ))}
                </div>
                <span className="text-sm text-foreground">{overlapBand.label}</span>
              </div>
            )}
          </div>
          <PivotRoleDetail option={option} state={state} stateLabel={stateLabel} stateCode={stateCode} tasks={tasks} currentTarget={currentTarget} showLocalOpenings />
        </CardContent>
      </Card>
    </PivotPathImpression>
  )
}
