'use client'

import { useEffect, useState } from 'react'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL, GRADE_BAND_DESCRIPTION } from '@/lib/scoring/grade'
import type { NextStep } from '@/lib/scoring/employability-score'
import { NextStepsList } from '@/components/candidates/NextStepsList'
import { cn } from '@/lib/utils'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']

const GRADE_LEGEND_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

function GradeLegend() {
  return (
    <div className="w-full max-w-sm space-y-1.5 text-left text-sm">
      <h3 className="text-xs font-medium text-muted-foreground">What the letters mean</h3>
      {GRADE_ORDER.map((g) => (
        <div key={g} className="flex items-baseline gap-2">
          <span className={cn('w-4 shrink-0 font-bold', GRADE_LEGEND_COLOR[g])}>{g}</span>
          <span className="text-muted-foreground">{GRADE_BAND_DESCRIPTION[g]}</span>
        </div>
      ))}
    </div>
  )
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

function GradeRing({ label, grade }: { label: string; grade: Grade | null }) {
  const [animatedFraction, setAnimatedFraction] = useState(0)
  const targetFraction = grade === null ? 0 : 1

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedFraction(targetFraction))
    return () => cancelAnimationFrame(raf)
  }, [targetFraction])

  const radius = 64
  const circumference = 2 * Math.PI * radius
  const offset = circumference - animatedFraction * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg width={160} height={160} className="-rotate-90">
          <circle cx={80} cy={80} r={radius} strokeWidth={12} className="fill-none stroke-muted" />
          {grade !== null && (
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
          )}
        </svg>
        <div className="absolute flex flex-col items-center px-4 text-center">
          {grade === null ? (
            <>
              <span className="text-3xl font-bold text-muted-foreground">N/A</span>
              <span className="text-xs text-muted-foreground">Starting line</span>
            </>
          ) : (
            <>
              <span className={cn('text-4xl font-bold', GRADE_TEXT_COLOR[grade])}>{grade}</span>
              <span className="text-xs text-muted-foreground">{GRADE_LABEL[grade]}</span>
            </>
          )}
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function DualGradeReveal({
  grade,
  nextSteps,
}: {
  grade: HireabilityGrade
  nextSteps: NextStep[]
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      <GradeRing label="Market Reality" grade={grade.marketReality.grade} />

      <GradeLegend />

      <NextStepsList nextSteps={nextSteps} heading="Get your full action plan, including:" />
    </div>
  )
}
