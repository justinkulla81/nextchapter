import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { addPivotSkillsToPlan, setPivotTargetRole } from '@/app/dashboard/pivot/actions'
import { PivotActionForm } from '@/components/dashboard/pivot/PivotActionForm'
import { LocalDemand } from '@/components/dashboard/pivot/LocalDemand'
import { TrainingForOption } from '@/components/dashboard/pivot/TrainingForOption'
import type { PivotOption } from '@/lib/careers/pivots'
import { describePay, formatPay, OEWS_WAGE_CEILING } from '@/lib/careers/local-pay'


function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

function payChange(option: PivotOption): string {
  const pct = option.wageDeltaPct
  if (pct === null) return ''
  const where = option.payBasis === 'METRO' ? 'your metro area' : option.payBasis === 'STATE' ? 'your state' : 'nationwide'
  const sign = pct > 0 ? '+' : ''
  if (option.payAtLeast) return ` (at least ${sign}${pct}% vs. your field, ${where})`
  if (pct === 0) return ` (about the same as your field, ${where})`
  return ` (${sign}${pct}% vs. your field, ${where})`
}

function PayFact({ option }: { option: PivotOption }) {
  const pay = option.pay
  const area = pay ? (pay.level === 'NATIONAL' ? 'nationwide' : pay.areaName) : null
  return (
    <Fact label={area ? `Median pay, ${area}` : 'Median pay'}>
      {describePay(pay)}
      {payChange(option)}
      {pay && pay.median !== null && pay.p25 !== null && pay.p75 !== null && (
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          Middle half earn {formatPay(pay.p25)} to {formatPay(pay.p75)}
        </span>
      )}
      {pay && pay.median === null && pay.ceilingHit && (
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          BLS does not publish exact pay above {formatPay(OEWS_WAGE_CEILING)} a year, so pay here is understated.
        </span>
      )}
    </Fact>
  )
}

export function PivotOptionCard({
  option,
  state,
  stateLabel,
  stateCode,
}: {
  option: PivotOption
  state: string | null
  stateLabel: string
  stateCode: string | null
}) {
  const overlapPct = option.overlap === null ? null : Math.round(option.overlap * 100)
  const skillsToAdd = [...option.toolGaps.map((t) => t.name), ...option.ratedGaps.filter((g) => g.kind === 'KNOWLEDGE').map((g) => g.name)]
  const broad = option.ratedGaps.filter((g) => g.kind === 'SKILL')

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{option.title}</h3>
            {option.onetRelated && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Listed as related by O*NET</span>
            )}
          </div>
          {overlapPct !== null && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-40 rounded-full bg-muted" role="img" aria-label={`${overlapPct}% of skills in common`}>
                <div className="h-2 rounded-full bg-foreground" style={{ width: `${Math.max(2, overlapPct)}%` }} />
              </div>
              <span className="text-sm text-foreground">{overlapPct}% of skills in common</span>
            </div>
          )}
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <PayFact option={option} />
          <Fact label="Projected 10-year growth">
            {option.growthPct === null ? 'Not available' : `${option.growthPct > 0 ? '+' : ''}${option.growthPct}%`}
          </Fact>
          <Fact label="Openings a year, nationally">
            {option.annualOpenings === null ? 'Not available' : option.annualOpenings.toLocaleString('en-US')}
          </Fact>
        </dl>

        {(option.toolGaps.length > 0 || option.ratedGaps.length > 0) && (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">What this role asks for that you may not show yet</p>
            {option.toolGaps.length > 0 && (
              <p className="text-muted-foreground">
                <span className="text-foreground">Tools:</span> {option.toolGaps.map((t) => t.name).join(', ')}
              </p>
            )}
            {option.ratedGaps.filter((g) => g.kind === 'KNOWLEDGE').length > 0 && (
              <p className="text-muted-foreground">
                <span className="text-foreground">Knowledge:</span>{' '}
                {option.ratedGaps.filter((g) => g.kind === 'KNOWLEDGE').map((g) => g.name).join(', ')}
              </p>
            )}
            {broad.length > 0 && (
              <p className="text-muted-foreground">
                <span className="text-foreground">Broader skills used at a higher level:</span> {broad.map((g) => g.name).join(', ')}
              </p>
            )}
          </div>
        )}

        <Suspense fallback={<p className="text-xs text-muted-foreground">Checking local openings…</p>}>
          <LocalDemand title={option.title} state={state} stateLabel={stateLabel} />
        </Suspense>

        <Suspense fallback={<p className="text-xs text-muted-foreground">Finding training…</p>}>
          <TrainingForOption
            socCode={option.socCode}
            title={option.title}
            skillIds={[...option.toolGaps.map((t) => t.skillId), ...option.ratedGaps.filter((g) => g.kind === 'KNOWLEDGE').map((g) => g.skillId)]}
            stateCode={stateCode}
          />
        </Suspense>

        <div className="flex flex-wrap gap-3">
          {skillsToAdd.length > 0 && (
            <PivotActionForm
              action={addPivotSkillsToPlan}
              fields={[{ name: 'socCode', value: option.socCode }, ...skillsToAdd.map((s) => ({ name: 'skill', value: s }))]}
              label="Add these skills to my plan"
              pendingLabel="Adding…"
              variant="default"
              ariaLabel={`Add the skills for ${option.title} to my plan`}
            />
          )}
          <PivotActionForm
            action={setPivotTargetRole}
            fields={[{ name: 'socCode', value: option.socCode }]}
            label="Make this my target role"
            pendingLabel="Saving…"
            ariaLabel={`Make ${option.title} my target role`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
