import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { getHiringAnalytics } from '@/lib/talent/hiring-analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TalentAnalyticsPage() {
  const employer = await getTalentDashboardData()
  const analytics = await getHiringAnalytics(employer.id)

  const maxCount = Math.max(1, ...analytics.funnel.map((s) => s.count))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hiring analytics</h1>
        <p className="mt-1 text-muted-foreground">Time-to-hire and funnel conversion across every role.</p>
      </div>

      {analytics.totalInteractions === 0 ? (
        <p className="text-sm text-muted-foreground">
          No candidate activity yet — post a role and view its candidate matches to get started.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Candidates engaged</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight text-foreground">{analytics.totalInteractions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Hired</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight text-foreground">{analytics.hiredCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg. time to hire</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {analytics.averageTimeToHireDays !== null ? `${analytics.averageTimeToHireDays} days` : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Funnel conversion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.funnel.map((stage) => (
                <div key={stage.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{stage.label}</span>
                    <span className="text-muted-foreground">{stage.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-brand"
                      style={{ width: `${(stage.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {analytics.passedCount > 0 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  {analytics.passedCount} candidate{analytics.passedCount === 1 ? '' : 's'} marked passed (excluded
                  from stage counts above).
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
