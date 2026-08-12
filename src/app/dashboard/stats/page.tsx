import type { Metadata } from 'next'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import {
  WEEKLY_ENGINE_LABEL,
  WEEKLY_ENGINE_EXPLANATION,
  GRADE_TEXT_COLOR,
  CATEGORY_ORDER,
  type WeeklyEngine,
} from '@/lib/scoring/grade'
import type { Grade } from '@/lib/scoring/grade'
import {
  getCategoryScoreHistory,
  computeBestWeekSentence,
  computeWhatMovedThisWeek,
  computeWeeksOfImprovement,
  computeSprintCompletionStreaks,
} from '@/lib/scoring/market-reality-history'
import { MarketRealityOverview } from '@/components/dashboard/MarketRealityOverview'
import { cn } from '@/lib/utils'
import { getCurrentWeekSprint, getCandidateWeekNumber, getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { estimateActionEffort, engineForActionType, ACTION_TYPE_LINK, getRecurringTargetCount } from '@/lib/weekly/action-effort'
import { getMoodHistory } from '@/lib/daily/mood'
import { MOOD_SCORE } from '@/lib/daily/mood-labels'
import { difficultyLevelToIntensityScore } from '@/lib/scoring/search-intensity'
import { computeWeeklyBadges } from '@/lib/badges/weekly-badges'
import { computeMilestoneBadges } from '@/lib/badges/milestone-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotivationChart } from '@/components/dashboard/MotivationChart'
import { MarketRealitySnapshotArchive } from '@/components/dashboard/MarketRealitySnapshotArchive'
import { StreakHeroBanner } from '@/components/dashboard/StreakHeroBanner'
import { BadgeShelf } from '@/components/dashboard/BadgeShelf'
import { EmptyState } from '@/components/ui/empty-state'
import type { NamedReason } from '@/lib/scoring/named-reasons'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

export const metadata: Metadata = { title: 'My Stats & Reports' }


type EngineKey = WeeklyEngine['key']
const ENGINE_ORDER: EngineKey[] = ['learning', 'effort', 'working', 'connecting']

const SECTIONS = [
  { id: 'badges', label: 'Badges' },
  { id: 'streaks', label: 'Streak details' },
  { id: 'market-reality', label: 'Market Reality' },
  { id: 'effort', label: "This week's effort" },
  { id: 'feeling', label: "How you've felt" },
  { id: 'actions', label: 'Actions completed' },
  { id: 'available-actions', label: 'All actions' },
] as const

export default async function YourStatsPage() {
  const profile = await getDashboardData()
  const weekStartDate = getMondayOfWeek(new Date())

  const [
    grade,
    applicationsCount,
    referencesSentCount,
    referencesCompletedCount,
    currentSprint,
    moodHistory,
    marketRealitySnapshots,
    weeklyBadges,
    milestoneBadges,
    weekNumber,
    sprintCompletionStreaks,
  ] = await Promise.all([
    computeHireabilityGrade(profile),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null } } }),
    prisma.reference.count({ where: { candidateId: profile.id } }),
    prisma.reference.count({ where: { candidateId: profile.id, status: 'COMPLETED' } }),
    getCurrentWeekSprint(profile.id),
    getMoodHistory(profile.id),
    prisma.marketRealitySnapshot.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'asc' },
    }),
    computeWeeklyBadges(profile.id),
    computeMilestoneBadges(profile.id),
    getCandidateWeekNumber(profile.id, weekStartDate),
    computeSprintCompletionStreaks(profile.id),
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

  const heroSnapshots = marketRealitySnapshots.slice(-12)
  const categoryHistory = new Map(
    CATEGORY_ORDER.map((key) => [key, getCategoryScoreHistory(heroSnapshots, key)])
  )

  const completedActionsCount = committedActions.filter((a) => a.completed).length
  const onTrackThisWeek = grade.weeklyPoints >= grade.weeklyPointsTarget

  // Flag support resources only when things are trending down AND landing
  // low right now — a dip from Fired up to Moving isn't the same signal as
  // sliding into Stuck, and we don't want to nag over normal fluctuation.
  const recentMoods = moodHistory.slice(-2)
  const isMoodDecliningAndLow =
    recentMoods.length === 2 &&
    MOOD_SCORE[recentMoods[1].mood] < MOOD_SCORE[recentMoods[0].mood] &&
    (recentMoods[1].mood === 'STUCK' || recentMoods[1].mood === 'GETTING_THERE')

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything behind your dashboard summary, in one place: your streak and badges, your
          Market Reality grade and its six categories, this week&apos;s effort, how you&apos;ve
          been feeling, and every action you&apos;ve done or could do.
        </p>
        <PageHeaderBoxes pageKey="stats" candidateId={profile.id} />
        <nav aria-label="Jump to section" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs text-primary underline underline-offset-4">
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <StreakHeroBanner currentStreak={profile.currentStreak} activeDays={activeDays} />

      <Card id="badges" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <BadgeShelf weeklyBadges={weeklyBadges} milestoneBadges={milestoneBadges} />
        </CardContent>
      </Card>

      <Card id="streaks" className="scroll-mt-4">
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
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{referencesSentCount}</p>
            <p className="text-xs text-muted-foreground">references sent</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{referencesCompletedCount}</p>
            <p className="text-xs text-muted-foreground">references completed</p>
          </div>
        </CardContent>
      </Card>

      <div id="market-reality" className="scroll-mt-4">
        <h2 className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Market Reality</h2>
        <div className="space-y-4">
          <MarketRealityOverview
            weekLabel={`Week ${weekNumber} · ${weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
            currentGrade={grade.grade}
            previousGrade={previousMarketRealityGrade}
            bestWeekSentence={computeBestWeekSentence(heroSnapshots)}
            trendSnapshots={heroSnapshots.map((s) => ({ weekStartDate: s.weekStartDate, grade: s.grade as Grade }))}
            categories={grade.categories}
            categoryHistory={categoryHistory}
            whatMoved={computeWhatMovedThisWeek(heroSnapshots)}
            sprintCompletionStreak={sprintCompletionStreaks.currentStreak}
            longestSprintCompletionStreak={sprintCompletionStreaks.longestStreak}
            weeksOfImprovement={computeWeeksOfImprovement(heroSnapshots)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Market Reality reports, week by week</CardTitle>
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
              <p className="mt-3 text-xs text-muted-foreground">
                The full narrative behind any week&apos;s grade lives on your{' '}
                <a href="/dashboard/hireability-report" className="text-primary underline underline-offset-4">
                  Market Reality Report
                </a>
                .
              </p>
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
              <p className="mt-1 text-sm text-muted-foreground">
                Points earned toward this week&apos;s target — the same number as &quot;Actions completed this
                week&quot; below.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card id="effort" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">This week&apos;s effort by category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Separate from the points total above — these four grades measure how you&apos;re spending your effort
            this week, not how much of it. Click a category to see the actions behind it.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {grade.weeklyEngines.map((e) => (
              <a
                key={e.key}
                href={`#available-${e.key}`}
                className="block rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-muted/40"
                title={WEEKLY_ENGINE_EXPLANATION[e.key]}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{WEEKLY_ENGINE_LABEL[e.key]}</span>
                  <span className={cn('text-sm font-semibold tabular-nums', GRADE_TEXT_COLOR[e.grade])}>{e.grade}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{WEEKLY_ENGINE_EXPLANATION[e.key]}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="feeling" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">How you&apos;ve been feeling</CardTitle>
        </CardHeader>
        <CardContent>
          <MotivationChart baseline={difficultyLevelToIntensityScore(profile.jobSearchDifficultyLevel)} history={moodHistory} />
          <p className="mt-3 text-xs text-muted-foreground">
            Private — only you and your coach (if you have one) ever see this. Never part of any
            export, and never visible to hiring managers or recruiters.
          </p>
          {isMoodDecliningAndLow && (
            <div className="mt-4 space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <p className="font-medium text-foreground">Your last check-in trended down — that&apos;s worth naming, not just tracking.</p>
              <p className="text-muted-foreground">
                A search that&apos;s dragging is genuinely hard, and it helps to talk to someone rather than push
                through it alone.
              </p>
              <ul className="space-y-1">
                <li>
                  <Link href="/dashboard/support" className="text-primary underline underline-offset-4">
                    I&apos;m Struggling
                  </Link>{' '}
                  <span className="text-muted-foreground">— crisis resources, therapist directories, and support hotlines.</span>
                </li>
                <li>
                  <Link href="/dashboard/community" className="text-primary underline underline-offset-4">
                    NextChapter Community
                  </Link>{' '}
                  <span className="text-muted-foreground">— people going through the exact same thing, in the same window.</span>
                </li>
                <li>
                  <Link href="/coaching" className="text-primary underline underline-offset-4">
                    Executive Coach
                  </Link>{' '}
                  <span className="text-muted-foreground">— 1:1 support built specifically for the emotional weight of a transition.</span>
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="actions" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Actions completed this week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {committedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t committed to this week&apos;s actions yet — set them up from the dashboard.
            </p>
          ) : (
            <>
              <div
                className={cn(
                  'rounded-lg border p-3 text-sm font-medium',
                  onTrackThisWeek ? 'border-success/30 bg-success/5 text-success' : 'border-error/30 bg-error/5 text-error'
                )}
              >
                {onTrackThisWeek ? 'On track' : 'Behind pace'}: you&apos;ve done{' '}
                <span className="tabular-nums">{completedActionsCount}</span> action
                {completedActionsCount === 1 ? '' : 's'} and earned{' '}
                <span className="tabular-nums">{grade.weeklyPoints}</span> of{' '}
                <span className="tabular-nums">{grade.weeklyPointsTarget}</span> points this week
              </div>

              {completedByEngine.size === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Nothing completed yet this week"
                  description="You've committed to this week's actions — check them off from the dashboard as you go."
                  cta={{ label: 'Go to dashboard', href: '/dashboard' }}
                />
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
                        {actions.map((a, i) => {
                          const targetCount = a.recurring ? getRecurringTargetCount(a.actionType) : null
                          const count = a.completionCount ?? (a.completed ? 1 : 0)
                          return (
                            <li
                              key={i}
                              className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-sm"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-success" aria-hidden>
                                  ✓
                                </span>
                                <span className="truncate text-foreground">{a.text}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {targetCount && (
                                  <span
                                    className={cn(
                                      'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                      count >= targetCount ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                    )}
                                  >
                                    {count} / {targetCount} this week
                                  </span>
                                )}
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
                                  {a.points} pts
                                </span>
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })
              )}
            </>
          )}
        </CardContent>
      </Card>

      <details id="available-actions" className="scroll-mt-4 group rounded-lg border border-border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          See all actions you can do
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            — every action across the app and where it lives, for browsing. Not required.
          </span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">
          {ENGINE_ORDER.map((engine) => {
            const tasks = availableByEngine.get(engine)
            if (!tasks || tasks.length === 0) return null
            return (
              <div key={engine} id={`available-${engine}`} className="scroll-mt-4">
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
        </div>
      </details>
    </div>
  )
}
