'use client'

import { useEffect, useState } from 'react'
import type { VisibilityTier } from '@prisma/client'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import type { NextStep } from '@/lib/scoring/employability-score'
import { NextStepsList } from '@/components/candidates/NextStepsList'
import { cn } from '@/lib/utils'

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

const GRADE_RING_STROKE: Record<Grade, string> = {
  A: 'stroke-success',
  B: 'stroke-brand',
  C: 'stroke-light-blue',
  D: 'stroke-warning',
  F: 'stroke-error',
}

const GRADE_TEXT_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

function GradeRing({ label, score, grade }: { label: string; score: number; grade: Grade }) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedScore(score))
    return () => cancelAnimationFrame(raf)
  }, [score])

  const radius = 64
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg width={160} height={160} className="-rotate-90">
          <circle cx={80} cy={80} r={radius} strokeWidth={12} className="fill-none stroke-muted" />
          <circle
            cx={80}
            cy={80}
            r={radius}
            strokeWidth={12}
            strokeLinecap="round"
            className={cn(
              'fill-none transition-[stroke-dashoffset] duration-1000 ease-out',
              GRADE_RING_STROKE[grade]
            )}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn('text-4xl font-bold', GRADE_TEXT_COLOR[grade])}>{grade}</span>
          <span className="text-xs text-muted-foreground">{GRADE_LABEL[grade]}</span>
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function DualGradeReveal({
  grade,
  tier,
  nextSteps,
}: {
  grade: HireabilityGrade
  tier: VisibilityTier
  nextSteps: NextStep[]
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-start justify-center gap-8">
        <GradeRing label="Market Reality" score={grade.marketReality.score} grade={grade.marketReality.grade} />
        <GradeRing
          label="Search Execution"
          score={grade.searchExecution.score}
          grade={grade.searchExecution.grade}
        />
      </div>

      <span className={cn('rounded-full px-3 py-1 text-sm font-medium', TIER_BADGE_STYLES[tier])}>
        {TIER_LABELS[tier]}
      </span>

      <NextStepsList nextSteps={nextSteps} />
    </div>
  )
}
