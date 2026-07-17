import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { SEARCH_EXECUTION_ENGINE_LABEL, type SearchExecutionEngine } from '@/lib/scoring/grade'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { estimateActionEffort, engineForActionType, ACTION_TYPE_LINK } from '@/lib/weekly/action-effort'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type EngineKey = SearchExecutionEngine['key']
const ENGINE_ORDER: EngineKey[] = ['learning', 'effort', 'working', 'connecting']

export default async function YourStatsPage() {
  const profile = await getDashboardData()

  const [grade, recentReports, applicationsCount, currentSprint] = await Promise.all([
    computeHireabilityGrade(profile),
    prisma.sundayNightReport.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'desc' },
      take: 12,
      select: { weekStartDate: true, gradeSnapshot: true, onAList: true },
    }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null } } }),
    getCurrentWeekSprint(profile.id),
  ])

  const aListWeeks = recentReports.filter((r) => r.onAList)
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your Stats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The full detail behind your dashboard summary — grade history, points by category, and
          your Weekly A List.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">This week&apos;s Search Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">{grade.searchExecution.grade}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {grade.searchExecution.weeklyPoints} / {grade.searchExecution.weeklyPointsTarget} points
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {grade.searchExecution.engines.map((e) => (
              <div key={e.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-foreground">{SEARCH_EXECUTION_ENGINE_LABEL[e.key]}</span>
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
                    {SEARCH_EXECUTION_ENGINE_LABEL[engine]}
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
                  {SEARCH_EXECUTION_ENGINE_LABEL[engine]}
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
          <CardTitle className="text-sm font-medium text-muted-foreground">Streak &amp; applications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{profile.currentStreak}</p>
            <p className="text-xs text-muted-foreground">day streak</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">{applicationsCount}</p>
            <p className="text-xs text-muted-foreground">applications sent</p>
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Grade history</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your weekly grade history will show up here after your first Sunday Night Report.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recentReports.map((r) => {
                const snapshot = r.gradeSnapshot as unknown as HireabilityGrade
                return (
                  <li
                    key={r.weekStartDate.toISOString()}
                    className="flex items-center justify-between text-sm text-foreground"
                  >
                    <span>
                      Week of {r.weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="tabular-nums">
                      {snapshot.marketReality.grade} / {snapshot.searchExecution.grade}
                      {r.onAList && ' 🅰️'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
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
