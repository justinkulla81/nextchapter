'use client'

import { useEffect, useState } from 'react'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { GRADE_LABEL, GRADE_BAND_DESCRIPTION, GRADE_TEXT_COLOR, GRADE_RING_STROKE } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']

function GradeLegend() {
  return (
    <div className="w-full max-w-lg space-y-3 text-left text-sm">
      <p className="text-muted-foreground">
        We&apos;re hard graders on purpose — a C isn&apos;t a bad grade, it&apos;s the honest,
        expected result for most candidates. A and F are reserved for real extremes.
      </p>
      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">What the letters mean</h3>
        {GRADE_ORDER.map((g) => (
          <div key={g} className="flex items-baseline gap-2">
            <span className={cn('w-4 shrink-0 font-bold', GRADE_TEXT_COLOR[g])}>{g}</span>
            <span className="text-muted-foreground">{GRADE_BAND_DESCRIPTION[g]}</span>
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

const HARD_HILL_GRADES: Grade[] = ['C', 'D', 'F']

function HardHillCallout() {
  return (
    <div className="w-full max-w-lg space-y-2 border-l-4 border-navy bg-off-white px-[1.375rem] py-4 text-left">
      <p className="font-bold text-navy">We know this seems like a hard hill to climb.</p>
      <p className="text-[15px] text-foreground">
        But that&apos;s exactly what NextChapter is for. Real, consistent weekly effort — networking,
        learning, and putting yourself out there — moves this grade over time.
      </p>
      <p className="text-[15px] text-foreground">
        You can also show recruiters you&apos;re serious by keeping your action plan up to date.
        Recruiters see your effort, not a raw number.
      </p>
    </div>
  )
}

export function GradeReveal({ grade }: { grade: HireabilityGrade }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <GradeRing grade={grade.grade} />

      <GradeLegend />

      {grade.grade !== null && HARD_HILL_GRADES.includes(grade.grade) && <HardHillCallout />}
    </div>
  )
}
