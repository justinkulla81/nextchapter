import Link from 'next/link'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

// Small, Duolingo-style summary strip — the "at a glance" read on where you
// stand, kept deliberately compact so it doesn't compete with the primary
// action below it for attention.
export function DashboardTopStrip({
  grade,
  searchExecutionAvailable,
  currentStreak,
  applicationsSent,
}: {
  grade: HireabilityGrade
  searchExecutionAvailable: boolean
  currentStreak: number
  applicationsSent: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-white px-5 py-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Market Reality</span>
        <span className={`text-lg font-bold ${GRADE_COLOR[grade.marketReality.grade]}`}>
          {grade.marketReality.grade}
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">This week</span>
        {searchExecutionAvailable ? (
          <>
            <span className={`text-lg font-bold ${GRADE_COLOR[grade.searchExecution.grade]}`}>
              {grade.searchExecution.grade}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({grade.searchExecution.weeklyPoints}/{grade.searchExecution.weeklyPointsTarget} pts)
            </span>
          </>
        ) : (
          <span className="text-lg font-bold text-muted-foreground">N/A</span>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span aria-hidden>🔥</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">{currentStreak}</span>
        <span className="text-xs text-muted-foreground">day streak</span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-foreground tabular-nums">{applicationsSent}</span>
        <span className="text-xs text-muted-foreground">applications sent</span>
      </div>

      <Link href="/dashboard/stats" className="ml-auto text-xs font-medium text-primary underline underline-offset-4">
        Your Stats →
      </Link>
    </div>
  )
}
