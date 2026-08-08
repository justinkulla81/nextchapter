import Link from 'next/link'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { GRADE_TEXT_COLOR } from '@/lib/scoring/grade'

function Divider() {
  return <div className="h-6 w-px bg-border" />
}

// Small, Duolingo-style summary strip — the "at a glance" read on where you
// stand, kept deliberately compact so it doesn't compete with the primary
// action below it for attention.
export function DashboardTopStrip({
  grade,
  searchExecutionAvailable,
  currentStreak,
  weekNumber,
  dayNumber,
  suppressUrgency,
}: {
  grade: HireabilityGrade
  searchExecutionAvailable: boolean
  currentStreak: number
  weekNumber: number
  dayNumber: number
  // True for candidates who told us they're only casually looking/exploring/
  // not actively searching — a week/day countdown implies a clock they're
  // not actually racing, so we drop it rather than manufacture urgency.
  suppressUrgency?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-white px-5 py-3">
      {!suppressUrgency && (
        <>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Week {weekNumber}, Day {dayNumber}
          </span>

          <Divider />
        </>
      )}

      <div className="flex items-center gap-1.5">
        <span aria-hidden>🔥</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">{currentStreak}</span>
        <span className="text-xs text-muted-foreground">day streak</span>
      </div>

      <Divider />

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Current Market Reality</span>
        <span className={`text-lg font-bold ${GRADE_TEXT_COLOR[grade.grade]}`}>{grade.grade}</span>
      </div>

      <Divider />

      <div
        className="flex items-center gap-1.5"
        title="The platform-wide points target for an A this week — separate from your own Weekly Search Sprint total below, which is just the actions you personally committed to."
      >
        <span className="text-xs font-medium text-muted-foreground">Weekly A Target</span>
        {searchExecutionAvailable ? (
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {grade.weeklyPoints} / {grade.weeklyPointsTarget}
          </span>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">N/A</span>
        )}
        {searchExecutionAvailable && grade.weeklyPoints > grade.weeklyPointsTarget && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            Over-delivering
          </span>
        )}
      </div>

      <Link href="/dashboard/stats" className="ml-auto text-xs font-medium text-primary underline underline-offset-4">
        View My Stats & Reports →
      </Link>
    </div>
  )
}
