import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { LinkedInConfirmForm } from '@/components/dashboard/LinkedInConfirmForm'
import { LinkedInUrlForm } from '@/components/dashboard/LinkedInUrlForm'
import { LinkedInActivityCard } from '@/components/dashboard/LinkedInActivityCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LinkedInPage() {
  const profile = await getDashboardData()

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30)
  const recentLogCount = profile.linkedInActivityLogs.filter((l) => l.loggedAt > windowStart).length
  const startOfTodayUTC = new Date()
  startOfTodayUTC.setUTCHours(0, 0, 0, 0)
  const loggedToday = profile.linkedInActivityLogs.some((l) => l.loggedAt >= startOfTodayUTC)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
        <p className="mt-1 text-muted-foreground">
          Visibility compounds — recruiters and your network see consistent activity, not just a static
          profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">LinkedIn Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.linkedInConfirmedAt === null ? (
            <LinkedInConfirmForm />
          ) : (
            <LinkedInUrlForm currentUrl={profile.linkedInUrl} />
          )}
        </CardContent>
      </Card>

      <LinkedInActivityCard recentLogCount={recentLogCount} loggedToday={loggedToday} />
    </div>
  )
}
