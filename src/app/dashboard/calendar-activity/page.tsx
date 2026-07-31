import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { getActivityReconciliation } from '@/lib/weekly/activity-reconciliation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarActivitySyncButton, CalendarActivityDismissButton } from '@/components/dashboard/CalendarActivityControls'
import { disconnectCalendar } from './actions'

export const metadata: Metadata = { title: 'Calendar Activity' }


export default async function CalendarActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ calendarConnected?: string; calendarError?: string }>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const isTester = profile.email ? await isCalendarTrackingTester(profile.email) : false

  const connection = await prisma.calendarConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })

  const events = connection
    ? await prisma.trackedCalendarEvent.findMany({
        where: { candidateId: profile.id },
        orderBy: { startTime: 'desc' },
      })
    : []

  const interviewCount = events.filter((e) => e.eventType === 'INTERVIEW').length
  const networkingCount = events.filter((e) => e.eventType === 'NETWORKING_CALL').length
  const reconciliation = connection ? await getActivityReconciliation(profile.id) : null
  const needsReview = events.filter((e) => e.eventType === 'NEEDS_REVIEW' && !e.reviewedAt)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendar Activity</h1>
        <p className="text-muted-foreground">
          Connect your calendar once and interviews and networking calls you actually attend count
          toward your Search Action Grade automatically — no manual logging.
        </p>
      </div>

      {params.calendarError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {params.calendarError === 'not_a_tester' &&
            "Calendar tracking is in internal testing right now — your account isn't on the tester list yet."}
          {params.calendarError === 'not_logged_in' && 'Please log in first.'}
          {params.calendarError === 'no_refresh_token' && 'Something went wrong connecting — please try again.'}
          {params.calendarError === 'exchange_failed' && 'Something went wrong connecting — please try again.'}
          {params.calendarError === 'not_configured' && 'Calendar connection is not available right now.'}
          {params.calendarError === 'denied' && "Connection wasn't completed."}
        </p>
      )}
      {params.calendarConnected && (
        <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Calendar connected — your activity will start showing up here.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Calendar connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connection ? (
            <>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Before you connect, here&apos;s exactly what this does:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Read-only.</strong> NextChapter can never create, edit, or delete anything on your
                    calendar.
                  </li>
                  <li>
                    <strong>What we look at:</strong> the title and time of events you&apos;ve already attended —
                    never anything on your calendar that hasn&apos;t happened yet.
                  </li>
                  <li>
                    <strong>Why:</strong> so interviews and networking calls count toward your grade
                    automatically, without you logging each one by hand.
                  </li>
                </ul>
              </div>
              {isTester ? (
                <Button nativeButton={false} render={<a href="/api/auth/calendar/start" />}>
                  Connect Calendar
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Calendar tracking is in internal testing right now — it&apos;s not yet open to all
                  candidates.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">
                Connected — 10 pts earned
                {connection.lastSyncAt && (
                  <span className="text-muted-foreground"> · last checked {connection.lastSyncAt.toLocaleString()}</span>
                )}
              </p>
              {connection.needsReconnectAt && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  Your calendar connection expired (this happens periodically while this feature is in
                  testing).{' '}
                  <a href="/api/auth/calendar/start" className="underline">
                    Reconnect
                  </a>
                  .
                </p>
              )}
              <div className="flex gap-2">
                <CalendarActivitySyncButton />
                <form action={disconnectCalendar}>
                  <Button type="submit" variant="outline" size="sm">
                    Disconnect
                  </Button>
                </form>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {connection && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Activity detected</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-foreground tabular-nums">{interviewCount}</p>
                <p className="text-xs text-muted-foreground">Interviews attended</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-foreground tabular-nums">{networkingCount}</p>
                <p className="text-xs text-muted-foreground">Networking calls</p>
              </div>
            </CardContent>
          </Card>

          {reconciliation?.interviewNote && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
              {reconciliation.interviewNote}
            </p>
          )}

          {needsReview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs review ({needsReview.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  These didn&apos;t match a clear pattern, so nothing was guessed — they don&apos;t count
                  toward your grade.
                </p>
                <ul className="space-y-1">
                  {needsReview.slice(0, 10).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{e.title || '(no title)'}</span>
                      <CalendarActivityDismissButton eventId={e.id} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
