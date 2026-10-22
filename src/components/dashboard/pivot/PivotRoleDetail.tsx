import { Suspense } from 'react'
import { addPivotSkillsToPlan } from '@/app/dashboard/pivot/actions'
import { SetTargetRoleForm } from '@/components/dashboard/pivot/SetTargetRoleForm'
import { PivotActionForm } from '@/components/dashboard/pivot/PivotActionForm'
import { LocalDemand } from '@/components/dashboard/pivot/LocalDemand'
import { TrainingForOption } from '@/components/dashboard/pivot/TrainingForOption'
import type { PivotOption } from '@/lib/careers/pivots'
import { describePay, formatPay, OEWS_WAGE_CEILING } from '@/lib/careers/local-pay'
import { aiMarketLineForOccupation } from '@/lib/skills/ai-skill-market'
import { ExposureFact, ExposureTag } from '@/components/candidate/AiExposure'
import type { OccupationExposure } from '@/lib/skills/ai-exposure'
import { exposureComparisonLine, payChangeLine } from '@/lib/skills/pivot-exposure'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  )
}

function payBasisLabel(option: PivotOption): string {
  return option.payBasis === 'METRO' ? 'your metro area' : option.payBasis === 'STATE' ? 'your state' : 'nationwide'
}

function PayFact({ option }: { option: PivotOption }) {
  const pay = option.pay
  const area = pay ? (pay.level === 'NATIONAL' ? 'nationwide' : pay.areaName) : null
  return (
    <Fact label={area ? `Median pay, ${area}` : 'Median pay'}>
      {describePay(pay)}
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

// What a role takes, from O*NET and BLS: pay where the person lives, growth, the day-to-day, the
// tools and knowledge they may not show yet, matching training, and the two things they can do
// about it. Shared by the "more roles" cards and the expander on each pivot path.
export function PivotRoleDetail({
  option,
  state,
  stateLabel,
  stateCode,
  tasks,
  currentTarget,
  showLocalOpenings,
  exposure = null,
  currentExposure = null,
}: {
  option: PivotOption
  state: string | null
  stateLabel: string
  stateCode: string | null
  tasks: string[]
  currentTarget: string | null
  /** Live local job counts. The market-ranked cards already show their own, so they leave this off. */
  showLocalOpenings: boolean
  /** Observed AI exposure of this role and of the member's current occupation; null when not measured (those lines are then hidden). */
  exposure?: OccupationExposure | null
  currentExposure?: OccupationExposure | null
}) {
  const skillsToAdd = [...option.toolGaps.map((t) => t.name), ...option.ratedGaps.filter((g) => g.kind === 'KNOWLEDGE').map((g) => g.name)]
  const broad = option.ratedGaps.filter((g) => g.kind !== 'KNOWLEDGE')
  // From the AI-skills analysis: how often this occupation's postings ask for AI, and the premium (raw and like-for-like).
  const ai = aiMarketLineForOccupation(option.socCode, option.title)
  const pay = payChangeLine(option.wageDeltaPct, option.payAtLeast)
  const comparison = exposureComparisonLine(currentExposure, exposure)

  return (
    <div className="space-y-4">
      {(pay || exposure) && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {pay && <span className="text-base font-semibold text-foreground">{pay}</span>}
            {exposure && <ExposureTag exposure={exposure} />}
          </div>
          {pay && <p className="text-xs text-muted-foreground">Median pay for this role, {payBasisLabel(option)}, compared like for like with your field.</p>}
        </div>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <PayFact option={option} />
        <Fact label="Projected 10-year growth">
          {option.growthPct === null ? 'Not available' : `${option.growthPct > 0 ? '+' : ''}${option.growthPct}%`}
        </Fact>
        <Fact label="Openings a year, nationally">
          {option.annualOpenings === null ? 'Not available' : option.annualOpenings.toLocaleString('en-US')}
        </Fact>
      </dl>

      {exposure && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">How much AI is used in this work</p>
          <ExposureFact exposure={exposure} />
          {comparison && <p className="text-sm font-medium text-foreground">{comparison}</p>}
        </div>
      )}

      {ai && <p className="text-xs text-muted-foreground">AI skills: {ai.text}</p>}

      {tasks.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">What the day-to-day looks like</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {tasks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

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
              <span className="text-foreground">Broader skills and work activities used at a higher level:</span> {broad.map((g) => g.name).join(', ')}
            </p>
          )}
        </div>
      )}

      {showLocalOpenings && (
        <Suspense fallback={<p className="text-xs text-muted-foreground">Checking local openings…</p>}>
          <LocalDemand title={option.title} state={state} stateLabel={stateLabel} />
        </Suspense>
      )}

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
            variant="outline"
            ariaLabel={`Add the skills for ${option.title} to my plan`}
          />
        )}
        <SetTargetRoleForm socCode={option.socCode} title={option.title} currentTarget={currentTarget} />
      </div>
    </div>
  )
}
