import Link from 'next/link'
import { CalendarDays, Flame, TrendingUp, Target, ChevronDown } from 'lucide-react'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { GRADE_TEXT_COLOR } from '@/lib/scoring/grade'
import { StatTile, type StatTileAccent } from '@/components/dashboard/StatTile'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { computeWeeklyBadges } from '@/lib/badges/weekly-badges'
import { computeMilestoneBadges } from '@/lib/badges/milestone-badges'
import { BadgeShelf } from '@/components/dashboard/BadgeShelf'
import { MarkBadgesViewedOnMount } from '@/components/dashboard/MarkBadgesViewedOnMount'

// The grade color tokens (text-success/text-brand/text-warning/text-error)
// double as StatTile accent keys — stripping the "text-" prefix reuses the
// one source of truth in grade.ts instead of a second grade->color map.
function gradeAccent(grade: HireabilityGrade['grade']): StatTileAccent {
  return GRADE_TEXT_COLOR[grade].replace('text-', '') as StatTileAccent
}

// Duolingo-style "at a glance" summary — stats strip + badge shelf combined
// into one Card, styled like the "Your Stats"/"Badges" boxes on
// /dashboard/stats (Prompt: dashboard should surface badges directly
// instead of requiring a trip to Stats to see them). Async because it
// computes badges itself; render inside a Suspense boundary so an uncached
// dashboard load never blocks on it.
export async function DashboardTopStrip({
  candidateId,
  grade,
  searchExecutionAvailable,
  currentStreak,
  weekNumber,
  dayNumber,
  suppressUrgency,
  badgesLastSeenCount,
}: {
  candidateId: string
  grade: HireabilityGrade
  searchExecutionAvailable: boolean
  currentStreak: number
  weekNumber: number
  dayNumber: number
  // True for candidates who told us they're only casually looking/exploring/
  // not actively searching — a week/day countdown implies a clock they're
  // not actually racing, so we drop it rather than manufacture urgency.
  suppressUrgency?: boolean
  badgesLastSeenCount: number | null
}) {
  const overDelivering = searchExecutionAvailable && grade.weeklyPoints > grade.weeklyPointsTarget

  const [weeklyBadges, milestoneBadges] = await Promise.all([
    computeWeeklyBadges(candidateId),
    computeMilestoneBadges(candidateId),
  ])
  const earnedBadgesCount = weeklyBadges.filter((b) => b.earned).length + milestoneBadges.filter((b) => b.earned).length
  const totalBadgesCount = weeklyBadges.length + milestoneBadges.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {!suppressUrgency && (
            <StatTile value={`Wk ${weekNumber} · Day ${dayNumber}`} label="Search week" accent="neutral" icon={CalendarDays} />
          )}

          <StatTile
            value={currentStreak}
            label="Day streak"
            accent={currentStreak > 0 ? 'brand' : 'neutral'}
            icon={Flame}
          />

          <StatTile
            value={searchExecutionAvailable ? `${grade.weeklyPoints} / ${grade.weeklyPointsTarget}` : 'N/A'}
            label="Weekly Search Score"
            accent={!searchExecutionAvailable ? 'neutral' : overDelivering ? 'success' : 'brand'}
            valueClassName={searchExecutionAvailable ? (overDelivering ? 'text-success' : 'text-error') : undefined}
            icon={Target}
            title="The platform-wide points target for an A this week — separate from your own Weekly Search Sprint total below, which is just the actions you personally committed to."
            href="/dashboard/stats#actions"
          />

          <StatTile
            value={grade.grade}
            label="Current Market Reality"
            accent={gradeAccent(grade.grade)}
            icon={TrendingUp}
            title="How the market currently sees you, based on your Hireability Assessment."
            href="/dashboard/hireability-report"
          />
        </div>

        <details
          className="scroll-mt-4 group rounded-lg border border-border"
          open={badgesLastSeenCount === null || earnedBadgesCount > badgesLastSeenCount}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span>
              Badges
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — {earnedBadgesCount} of {totalBadgesCount} earned so far
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border p-4">
            <BadgeShelf weeklyBadges={weeklyBadges} milestoneBadges={milestoneBadges} />
          </div>
        </details>
        <MarkBadgesViewedOnMount earnedBadgesCount={earnedBadgesCount} />

        <Link href="/dashboard/stats" className="block text-xs font-medium text-primary underline underline-offset-4">
          View My Stats & Reports →
        </Link>
      </CardContent>
    </Card>
  )
}

// Suspense fallback while badges are computed — mirrors the stat grid's
// dimensions so the page doesn't jump when the real content lands.
export function DashboardTopStripSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-lg border border-border bg-muted/30" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
