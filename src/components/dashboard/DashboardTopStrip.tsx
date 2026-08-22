import Link from 'next/link'
import { CalendarDays, Flame, TrendingUp, Target, ChevronDown } from 'lucide-react'
import type { Grade } from '@/lib/scoring/grade'
import { GRADE_TEXT_COLOR } from '@/lib/scoring/grade'
import type { WeeklyProgress } from '@/lib/weekly/weekly-engines'
import { StatTile, type StatTileAccent } from '@/components/dashboard/StatTile'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { computeWeeklyBadges, WEEKLY_BADGE_LABEL, WEEKLY_BADGE_DESCRIPTION, type WeeklyBadgeKey } from '@/lib/badges/weekly-badges'
import { computeMilestoneBadges, MILESTONE_BADGE_LABEL, MILESTONE_BADGE_DESCRIPTION, type MilestoneBadgeKey } from '@/lib/badges/milestone-badges'
import { LEADERBOARD_BADGE_LABEL, type LeaderboardBadgeKey } from '@/lib/leaderboard/badges'
import { getPendingBadgeNotices } from '@/lib/badges/badge-notifications'
import { BadgeShelf } from '@/components/dashboard/BadgeShelf'
import { MarkBadgesViewedOnMount } from '@/components/dashboard/MarkBadgesViewedOnMount'
import { BadgeEarnedDialog, type BadgeNotice } from '@/components/dashboard/BadgeEarnedDialog'

// The grade color tokens (text-success/text-brand/text-warning/text-error)
// double as StatTile accent keys — stripping the "text-" prefix reuses the
// one source of truth in grade.ts instead of a second grade->color map.
function gradeAccent(grade: Grade): StatTileAccent {
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
  weeklyProgress,
  marketRealityGrade,
  searchExecutionAvailable,
  currentStreak,
  weekNumber,
  dayNumber,
  suppressUrgency,
  badgesLastSeenCount,
}: {
  candidateId: string
  weeklyProgress: WeeklyProgress
  // The day-one Market Reality Grade (resume + experience, plus the market
  // cap) — null until a resume has been analyzed.
  marketRealityGrade: Grade | null
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
  const overDelivering = searchExecutionAvailable && weeklyProgress.weeklyPoints > weeklyProgress.weeklyPointsTarget

  const [weeklyBadges, milestoneBadges] = await Promise.all([
    computeWeeklyBadges(candidateId),
    computeMilestoneBadges(candidateId),
  ])
  // Read AFTER the computes above so a badge that just got persisted this
  // very render (see persistWeeklyBadgesAndNotify/persistMilestoneBadgesAndNotify)
  // shows up in the popup immediately, not one page load later.
  const pendingBadgeNotices = await getPendingBadgeNotices(candidateId)
  const badgeNotices: BadgeNotice[] = [
    // WeeklyBadgeEarned also holds the leaderboard TOP3_* rows (see
    // computeAndRecordLeaderboardBadges) — WEEKLY_BADGE_LABEL alone doesn't
    // cover those, so fall back to LEADERBOARD_BADGE_LABEL.
    ...pendingBadgeNotices.weekly.map((n) => ({
      id: n.id,
      source: 'weekly' as const,
      badgeKey: n.badgeKey,
      label:
        WEEKLY_BADGE_LABEL[n.badgeKey as WeeklyBadgeKey] ??
        LEADERBOARD_BADGE_LABEL[n.badgeKey as LeaderboardBadgeKey] ??
        n.badgeKey,
      description: WEEKLY_BADGE_DESCRIPTION[n.badgeKey as WeeklyBadgeKey] ?? '',
    })),
    ...pendingBadgeNotices.milestone.map((n) => ({
      id: n.id,
      source: 'milestone' as const,
      badgeKey: n.badgeKey,
      label: MILESTONE_BADGE_LABEL[n.badgeKey as MilestoneBadgeKey] ?? n.badgeKey,
      description: MILESTONE_BADGE_DESCRIPTION[n.badgeKey as MilestoneBadgeKey] ?? '',
    })),
  ]
  const earnedBadgesCount = weeklyBadges.filter((b) => b.earned).length + milestoneBadges.filter((b) => b.earned).length
  const totalBadgesCount = weeklyBadges.length + milestoneBadges.length
  // First-ever dashboard visit shows the full board (all 32 slots, most
  // locked) so a brand-new candidate can see the whole game up front —
  // every visit after that only shows what's actually been earned, since a
  // permanent wall of grayed-out locks stops being informative and starts
  // being clutter once there's real progress to show instead.
  const isFirstVisit = badgesLastSeenCount === null

  return (
    <Card>
      <BadgeEarnedDialog notices={badgeNotices} />
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
            value={searchExecutionAvailable ? `${weeklyProgress.weeklyPoints} / ${weeklyProgress.weeklyPointsTarget}` : 'N/A'}
            label="Weekly Search Score"
            accent={!searchExecutionAvailable ? 'neutral' : overDelivering ? 'success' : 'brand'}
            valueClassName={searchExecutionAvailable ? (overDelivering ? 'text-success' : 'text-error') : undefined}
            icon={Target}
            title="The platform-wide points target for an A this week — separate from your own Weekly Search Sprint total below, which is just the actions you personally committed to."
            href="/dashboard/stats#actions"
          />

          <StatTile
            value={marketRealityGrade ?? 'N/A'}
            label="Current Market Reality"
            accent={marketRealityGrade ? gradeAccent(marketRealityGrade) : 'neutral'}
            icon={TrendingUp}
            title="How the market currently sees you, based on your resume and experience."
            href="/dashboard/market-reality"
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
            <BadgeShelf weeklyBadges={weeklyBadges} milestoneBadges={milestoneBadges} showLocked={isFirstVisit} combined />
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
