import Link from 'next/link'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { GRADE_TEXT_COLOR } from '@/lib/scoring/grade'
import { StatTile, type StatTileAccent } from '@/components/dashboard/StatTile'

// The grade color tokens (text-success/text-brand/text-warning/text-error)
// double as StatTile accent keys — stripping the "text-" prefix reuses the
// one source of truth in grade.ts instead of a second grade->color map.
function gradeAccent(grade: HireabilityGrade['grade']): StatTileAccent {
  return GRADE_TEXT_COLOR[grade].replace('text-', '') as StatTileAccent
}

// Small, Duolingo-style summary strip — the "at a glance" read on where you
// stand, kept deliberately compact so it doesn't compete with the primary
// action below it for attention. Shares the StatTile component with the
// Network page's stats grid so both read as the same "stats" pattern.
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
  const overDelivering = searchExecutionAvailable && grade.weeklyPoints > grade.weeklyPointsTarget

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!suppressUrgency && (
          <StatTile value={`Wk ${weekNumber} · Day ${dayNumber}`} label="Search week" accent="neutral" />
        )}

        <StatTile value={`🔥 ${currentStreak}`} label="Day streak" accent={currentStreak > 0 ? 'brand' : 'neutral'} />

        <StatTile value={grade.grade} label="Current Market Reality" accent={gradeAccent(grade.grade)} />

        <StatTile
          value={searchExecutionAvailable ? `${grade.weeklyPoints} / ${grade.weeklyPointsTarget}` : 'N/A'}
          label="Weekly A target"
          accent={!searchExecutionAvailable ? 'neutral' : overDelivering ? 'success' : 'brand'}
          statusText={overDelivering ? 'Over-delivering' : undefined}
          title="The platform-wide points target for an A this week — separate from your own Weekly Search Sprint total below, which is just the actions you personally committed to."
        />
      </div>

      <div className="text-right">
        <Link href="/dashboard/stats" className="text-xs font-medium text-primary underline underline-offset-4">
          View My Stats & Reports →
        </Link>
      </div>
    </div>
  )
}
