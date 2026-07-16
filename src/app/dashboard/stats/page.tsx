import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { computeHireabilityGrade } from '@/lib/scoring/hireability-grade'
import { SEARCH_EXECUTION_ENGINE_LABEL } from '@/lib/scoring/grade'
import type { HireabilityGrade } from '@/lib/scoring/grade'
import { WorkStyleProfileCard } from '@/components/dashboard/WorkStyleProfileCard'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function YourStatsPage() {
  const profile = await getDashboardData()

  const [grade, recentReports, applicationsCount] = await Promise.all([
    computeHireabilityGrade(profile),
    prisma.sundayNightReport.findMany({
      where: { candidateId: profile.id },
      orderBy: { weekStartDate: 'desc' },
      take: 12,
      select: { weekStartDate: true, gradeSnapshot: true, onAList: true },
    }),
    prisma.jobPosting.count({ where: { candidateId: profile.id, appliedAt: { not: null } } }),
  ])
  const latestAssessment = profile.assessmentResponses[0]

  const aListWeeks = recentReports.filter((r) => r.onAList)

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
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This week&apos;s points, by category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {grade.searchExecution.engines.map((e) => (
              <div key={e.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-foreground">{SEARCH_EXECUTION_ENGINE_LABEL[e.key]}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{e.grade}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {grade.searchExecution.weeklyPoints} of {grade.searchExecution.weeklyPointsTarget} points
            toward this week&apos;s A, spread across all four.
          </p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Work Style Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {latestAssessment ? (
            <WorkStyleProfileCard
              dimensionVectors={latestAssessment.dimensionVectors as unknown as DimensionVectors}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A quick, optional assessment of how you prefer to work — helps us (and your
                references) understand what makes you thrive, not just what you can do.
              </p>
              <a
                href="/onboarding/working-style"
                className="inline-block text-sm font-medium text-primary underline underline-offset-4"
              >
                Take the Work Style Assessment
              </a>
            </div>
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
