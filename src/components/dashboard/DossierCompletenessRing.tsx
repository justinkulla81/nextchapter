'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Prompt 67 — visual completeness indicator for the Executive Dossier, tied
// directly to the Dossier Complete badge (Prompt 51, milestone-badges.ts)
// as the goal it's building toward: the ring reaches 100% exactly when
// every section here has real content, which is the same condition
// isDossierComplete() checks for that badge. A ring rather than a bar per
// spec — mirrors the same SVG approach as GradeReveal's GradeRing.
export function DossierCompletenessRing({ completed, total }: { completed: number; total: number }) {
  const [animatedFraction, setAnimatedFraction] = useState(0)
  const targetFraction = total === 0 ? 0 : completed / total

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimatedFraction(targetFraction))
    return () => cancelAnimationFrame(raf)
  }, [targetFraction])

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - animatedFraction * circumference
  const isComplete = total > 0 && completed === total

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex shrink-0 items-center justify-center">
        <svg width={92} height={92} className="-rotate-90">
          <circle cx={46} cy={46} r={radius} strokeWidth={8} className="fill-none stroke-muted" />
          <circle
            cx={46}
            cy={46}
            r={radius}
            strokeWidth={8}
            strokeLinecap="round"
            className={cn(
              'fill-none transition-[stroke-dashoffset] duration-700 ease-out',
              isComplete ? 'stroke-success' : 'stroke-brand'
            )}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn('text-lg font-bold tabular-nums', isComplete ? 'text-success' : 'text-brand')}>
            {completed}/{total}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          {isComplete ? 'Dossier complete' : 'Dossier completeness'}
        </p>
        <p className="text-xs text-muted-foreground">
          {isComplete
            ? "Every section has real content — you've earned the Dossier Complete badge."
            : `${total - completed} section${total - completed === 1 ? '' : 's'} still to fill in.`}
        </p>
      </div>
    </div>
  )
}
