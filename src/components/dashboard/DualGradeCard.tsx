import type { VisibilityTier } from '@prisma/client'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import type { NextStep } from '@/lib/scoring/employability-score'
import type { ScoreFramingCopy } from '@/lib/scoring/score-framing'
import { NextStepsList } from '@/components/candidates/NextStepsList'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

const FACTOR_TYPE_LABEL: Record<string, string> = {
  controllable: 'Controllable',
  influenceable: 'Influenceable',
  structural: 'Structural',
}

const TIER_LABELS: Record<VisibilityTier, string> = {
  EMERGING: 'Emerging',
  SIGNAL: 'Signal',
  VERIFIED: 'Verified',
  SPOTLIGHT: 'Spotlight',
}

const TIER_BADGE_STYLES: Record<VisibilityTier, string> = {
  EMERGING: 'bg-light-gray text-muted-foreground',
  SIGNAL: 'bg-brand/10 text-brand',
  VERIFIED: 'bg-success/10 text-success',
  SPOTLIGHT: 'bg-orange/20 text-navy',
}

function GradeColumn({
  label,
  sublabel,
  grade,
  score,
  rows,
}: {
  label: string
  sublabel: string
  grade: Grade
  score: number
  rows: { key: string; label: string; grade: Grade; factorType?: string }[]
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className={cn('mt-1 text-4xl font-bold tabular-nums', GRADE_COLOR[grade])}>
        {grade}
        <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">
          {GRADE_LABEL[grade]} · {score}/100
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      <div className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{r.label}</span>
            <span className="flex items-center gap-2">
              {r.factorType && (
                <span className="text-xs text-muted-foreground">{FACTOR_TYPE_LABEL[r.factorType]}</span>
              )}
              <span className={cn('font-semibold tabular-nums', GRADE_COLOR[r.grade])}>{r.grade}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DualGradeCard({
  grade,
  tier,
  nextSteps,
  framingCopy,
  scoreLastCalculated,
}: {
  grade: HireabilityGrade
  tier: VisibilityTier
  nextSteps: NextStep[]
  framingCopy: ScoreFramingCopy
  scoreLastCalculated: Date | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">Your Hireability Grade</p>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium', TIER_BADGE_STYLES[tier])}>
          {TIER_LABELS[tier]}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <GradeColumn
          label="Market Reality"
          sublabel="Your honest market position — some of it outside your control."
          grade={grade.marketReality.grade}
          score={grade.marketReality.score}
          rows={grade.marketReality.dimensions.map((d) => ({
            key: d.key,
            label: d.label,
            grade: d.grade,
            factorType: d.factorType,
          }))}
        />
        <GradeColumn
          label="Search Execution"
          sublabel="How well you're running your search — everyone can bring this one to an A."
          grade={grade.searchExecution.grade}
          score={grade.searchExecution.score}
          rows={grade.searchExecution.engines.map((e) => ({
            key: e.key,
            label: `${e.label} Engine`,
            grade: e.grade,
          }))}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {framingCopy.type === 'percentile'
          ? `You're in the top ${framingCopy.topPercent}% of candidates.`
          : framingCopy.message}
      </p>

      {scoreLastCalculated && (
        <p className="text-xs text-muted-foreground">
          Last updated {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(scoreLastCalculated)}
        </p>
      )}

      <NextStepsList nextSteps={nextSteps} />
    </div>
  )
}
