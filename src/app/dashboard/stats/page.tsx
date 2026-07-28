import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade, normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { WEEKLY_ENGINE_LABEL, type WeeklyEngine } from '@/lib/scoring/grade'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { estimateActionEffort, engineForActionType, ACTION_TYPE_LINK } from '@/lib/weekly/action-effort'
import { getMoodHistory } from '@/lib/daily/mood'
import { difficultyLevelToIntensityScore } from '@/lib/scoring/search-intensity'
import { getDailyActivity } from '@/lib/stats/activity-heatmap'
import { getLastWeekActions } from '@/lib/stats/last-week-actions'
import { computeWeeklyBadges } from '@/lib/badges/weekly-badges'
import { computeMilestoneBadges } from '@/lib/badges/milestone-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotivationChart } from '@/components/dashboard/MotivationChart'
import { MarketRealityTrendChart } from '@/components/dashboard/MarketRealityTrendChart'
import { MarketRealitySnapshotArchive } from '@/components/dashboard/MarketRealitySnapshotArchive'
import { StreakHeroBanner } from '@/components/dashboard/StreakHeroBanner'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { BadgeShelf } from '@/components/dashboard/BadgeShelf'
import type { NamedReason } from '@/lib/scoring/named-reasons'

type EngineKey = WeeklyEngine['key']
const ENGINE_ORDER: EngineKey[] = ['learning', 'effort', 'working', 'connecting']

const GRADE_VALUE: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
type Delta = 'up' | 'down' | 'flat' | null
function gradeDelta(current: Grade, previous: Grade | null): Delta {
  if (!previous) return null
  const diff = GRADE_VALUE[current] - GRADE_VALUE[previous]
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}
const DELTA_ICON: Record<Exclude<Delta, null>, string> = { up: '↑', down: '↓', flat: '→' }

export default async function YourStatsPage() {
  const profile = await getDashboardData()

  const [
    grade,
    recentReports,
    applicationsCount,
    currentSprint,
    moodHistory,
    marketRealitySnapshots,
    dailyActivity,
    lastWeekActions,
    weeklyBadges,
    milestoneBadges,
    aListWeeks,
  ] = await Promise.all([
    computeHireabilityGrade(profile),
    prisma.sundayNightReport.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'desc' },
      take: 12,
      select: { weekStartDate: true, gradeSnapshot: true },
    }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null } } }),
    getCurrentWeekSprint(profile.id),
    getMoodHistory(profile.id),
    prisma.marketRealitySnapshot.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'asc' },
    }),
    getDailyActivity(profile.id),
    getLastWeekActions(profile.id),
    computeWeeklyBadges(profile.id),
    computeMilestoneBadges(profile.id),
    // Sourced from WeeklyBadgeEarned, the real currently-written record —
    // SundayNightReport.onAList is legacy and nothing writes to it anymore
    // (see src/lib/badges/weekly-badge-archive.ts).
    prisma.weeklyBadgeEarned.findMany({
      where: { candidateId: profile.id, badgeKey: 'WEEKLY_SCORE_A_LIST' },
      orderBy: { weekStartDate: 'desc' },
      take: 12,
      select: { weekStartDate: true },
    }),
  ])

  const committedActions = currentSprint ? (currentSprint.committedActions as unknown as CommittedAction[]) : []
  const completedByEngine = new Map<EngineKey, CommittedAction[]>()
  for (const action of committedActions) {
    if (!action.completed || !action.actionType) continue
    const engine = engineForActionType(action.actionType)
    completedByEngine.set(engine, [...(completedByEngine.get(engine) ?? []), action])
  }

  const availableByEngine = new Map<EngineKey, { text: string; actionType?: string; points: number }[]>()
  for (const task of CANONICAL_TASK_MENU) {
    const engine = engineForActionType(task.actionType)
    const points = estimateActionEffort(task).points
    availableByEngine.set(engine, [
      ...(availableByEngine.get(engine) ?? []),
      { text: task.text, actionType: task.actionType, points },
    ])
  }

  // 7-day activity strip for the hero banner — "had activity" = checked in
  // that day, same signal that drives currentStreak, so the strip and the
  // streak number never disagree.
  const checkedInDays = new Set(moodHistory.map((m) => m.date.toISOString().slice(0, 10)))
  const activeDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return checkedInDays.has(d.toISOString().slice(0, 10))
  })

  const previousMarketRealityGrade =
    marketRealitySnapshots.length > 0 ? (marketRealitySnapshots[marketRealitySnapshots.length - 1].grade as Grade) : null
  const weeklyScoreSnapshots = [...recentReports]
    .reverse()
    .map((r) => ({
      weekStartDate: r.weekStartDate,
      grade: normalizeGradeSnapshot(r.gradeSnapshot)!.grade,
    }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The full detail behind your dashboard summary — grade history, points by category, and
          your Weekly A List.
        </p>
      </div>

      <StreakHeroBanner currentStreak={profile.currentStreak} activeDays={activeDays} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Market Reality Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{grade.grade}</span>
              {(() => {
                const delta = gradeDelta(grade.grade, previousMarketRealityGrade)
                return delta ? (
                  <span className="text-sm text-muted-foreground">
                    {DELTA_ICON[delta]} vs last week ({previousMarketRealityGrade})
                  </span>
                ) : null
              })()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Search Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {grade.weeklyPoints} / {grade.weeklyPointsTarget}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">points this week</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <BadgeShelf weeklyBadges={weeklyBadges} milestoneBadges={milestoneBadges} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Market Reality Grade trend</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketRealityTrendChart
            snapshots={marketRealitySnapshots.map((s) => ({ weekStartDate: s.weekStartDate, grade: s.grade as Grade }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Search Score trend</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketRealityTrendChart
            snapshots={weeklyScoreSnapshots}
            emptyStateText="Your Weekly Search Score trend will show up here after a couple of weekly reports."
            ariaLabel="Weekly Search Score over time"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">How you&apos;ve been feeling</CardTitle>
        </CardHeader>
        <CardContent>
          <MotivationChart baseline={difficultyLevelToIntensityScore(profile.jobSearchDifficultyLevel)} history={moodHistory} />
          <p className="mt-3 text-xs text-muted-foreground">
            Private — only you and your coach (if you have one) ever see this. Never part of any
            export, and never visible to hiring managers or recruiters.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap activity={dailyActivity} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Last week&apos;s actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!lastWeekActions ? (
            <p className="text-sm text-muted-foreground">No committed Sprint on file for last week.</p>
          ) : (
            <>
              {lastWeekActions.committed.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Committed</h3>
                  <ul className="mt-2 space-y-1">
                    {lastWeekActions.committed.map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className={a.completed ? 'text-foreground' : 'text-muted-foreground'}>
                          {a.completed ? '✓ ' : ''}
                          {a.text}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.points} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lastWeekActions.fromCatalog.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    From the catalog
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {lastWeekActions.fromCatalog.map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className={a.completed ? 'text-foreground' : 'text-muted-foreground'}>
                          {a.completed ? '✓ ' : ''}
                          {a.text}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.points} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Grade history log</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketRealitySnapshotArchive
            snapshots={[...marketRealitySnapshots].reverse().map((s) => ({
              id: s.id,
              weekStartDate: s.weekStartDate,
              grade: s.grade as Grade,
              namedReasons: s.namedReasons as unknown as NamedReason[],
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Streak details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{profile.currentStreak}</p>
            <p className="text-xs text-muted-foreground">current streak</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{profile.longestStreak}</p>
            <p className="text-xs text-muted-foreground">longest streak ever</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{applicationsCount}</p>
            <p className="text-xs text-muted-foreground">applications sent</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">This week&apos;s Search Score detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {grade.weeklyEngines.map((e) => (
              <div key={e.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-foreground">{WEEKLY_ENGINE_LABEL[e.key]}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{e.grade}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Actions completed this week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {committedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t committed to this week&apos;s actions yet — set them up from the dashboard.
            </p>
          ) : (
            ENGINE_ORDER.map((engine) => {
              const actions = completedByEngine.get(engine)
              if (!actions || actions.length === 0) return null
              return (
                <div key={engine}>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {WEEKLY_ENGINE_LABEL[engine]}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {actions.map((a, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{a.text}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.points} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">See all actions you can do</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {ENGINE_ORDER.map((engine) => {
            const tasks = availableByEngine.get(engine)
            if (!tasks || tasks.length === 0) return null
            return (
              <div key={engine}>
                <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  {WEEKLY_ENGINE_LABEL[engine]}
                </h3>
                <ul className="mt-2 space-y-1">
                  {tasks.map((task, i) => {
                    const href = task.actionType ? ACTION_TYPE_LINK[task.actionType]?.href : undefined
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        {href ? (
                          <Link href={href} className="text-foreground hover:underline">
                            {task.text}
                          </Link>
                        ) : (
                          <span className="text-foreground">{task.text}</span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{task.points} pts</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Weekly A List</CardTitle>
        </CardHeader>
        <CardContent>
          {aListWeeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No A weeks yet — hit your weekly point target to start your Weekly A List.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {aListWeeks.map((r) => (
                <li key={r.weekStartDate.toISOString()} className="flex items-center gap-2 text-sm">
                  <span aria-hidden>🅰️</span>
                  <span className="text-foreground">
                    Week of {r.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Private and personal — never a public leaderboard. Only you see this.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Grades are explained in full on your{' '}
        <a href="/dashboard/hireability-report" className="text-primary underline underline-offset-4">
          Hireability Report
        </a>
        .
      </p>
    </div>
  )
}
