'use client'

import { useEffect, useState } from 'react'
import type { Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL, GRADE_BAND_DESCRIPTION, GRADE_INTERVIEW_ODDS, GRADE_TEXT_COLOR, GRADE_RING_STROKE } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']

function GradeLegend() {
  return (
    <div className="w-full max-w-lg space-y-3 text-left text-sm">
      <p className="text-muted-foreground">
        We&apos;re hard graders on purpose — a C isn&apos;t a bad grade, it&apos;s the honest,
        expected result for most candidates. A and F are reserved for real extremes.
      </p>
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground">What the letters mean</h3>
        {GRADE_ORDER.map((g) => (
          <div key={g} className="flex items-baseline gap-2">
            <span className={cn('w-4 shrink-0 font-bold', GRADE_TEXT_COLOR[g])}>{g}</span>
            <div>
              <p className="text-muted-foreground">{GRADE_BAND_DESCRIPTION[g]}</p>
              <p className="mt-0.5 text-xs text-muted-foreground italic">{GRADE_INTERVIEW_ODDS[g]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GradeRing({ grade }: { grade: Grade | null }) {
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
      <p className="text-sm font-medium text-muted-foreground">Current Market Reality</p>
    </div>
  )
}

export function GradeReveal({ grade }: { grade: Grade | null }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <GradeRing grade={grade} />

      <GradeLegend />
    </div>
  )
}
