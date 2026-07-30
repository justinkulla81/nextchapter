import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'
import { getRejectionReframe, getOfferCongrats } from '@/lib/email-tracking/victoria-reactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmailActivitySyncButton, EmailActivityAcknowledgeButton } from '@/components/dashboard/EmailActivityControls'
import { disconnectGmail } from './actions'

const SENT_LABEL: Record<string, string> = {
  THANK_YOU: 'Thank-you notes',
  FOLLOW_UP: 'Follow-up notes',
  CHECK_IN: 'Check-in notes',
  INTRO_REQUEST: 'Intro/connection requests',
}
const INBOUND_LABEL: Record<string, string> = {
  APPLICATION_CONFIRMATION: 'Application confirmations',
  RECRUITER_OUTREACH: 'Recruiter outreach',
  INTERVIEW_INVITE: 'Interview invites',
  REJECTION: 'Rejections',
  OFFER: 'Offers',
}

export default async function EmailActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ gmailConnected?: string; gmailError?: string }>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const isTester = profile.email ? isGmailTrackingTester(profile.email) : false

  const connection = await prisma.emailConnection.findFirst({
    where: { candidateId: profile.id, disconnectedAt: null },
  })

  const activities = connection
    ? await prisma.trackedEmailActivity.findMany({
        where: { candidateId: profile.id },
        orderBy: { detectedAt: 'desc' },
      })
    : []

  const counts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.activityType] = (acc[a.activityType] ?? 0) + 1
    return acc
  }, {})
  const needsReview = activities.filter((a) => a.activityType === 'NEEDS_REVIEW')
  const unacknowledgedReactions = activities.filter(
    (a) => (a.activityType === 'REJECTION' || a.activityType === 'OFFER') && !a.reviewedAt
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Activity</h1>
        <p className="text-muted-foreground">
          Connect Gmail once and your application confirmations, interview invites, rejections, offers, and
          networking notes count toward your Search Action Grade automatically — no manual logging.
        </p>
      </div>

      {params.gmailError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {params.gmailError === 'not_a_tester' &&
            "Gmail tracking is in internal testing right now — your account isn't on the tester list yet."}
          {params.gmailError === 'not_logged_in' && 'Please log in first.'}
          {params.gmailError === 'no_refresh_token' && 'Something went wrong connecting — please try again.'}
          {params.gmailError === 'exchange_failed' && 'Something went wrong connecting — please try again.'}
          {params.gmailError === 'not_configured' && 'Gmail connection is not available right now.'}
          {params.gmailError === 'denied' && "Connection wasn't completed."}
        </p>
      )}
      {params.gmailConnected && (
        <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Gmail connected — your activity will start showing up here.
        </p>
      )}

      {unacknowledgedReactions.map((activity) => (
        <Card key={activity.id} className={activity.activityType === 'OFFER' ? 'border-success/40' : ''}>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-foreground">
              {activity.activityType === 'REJECTION'
                ? getRejectionReframe(activity.id.length)
                : getOfferCongrats(activity.id.length)}
            </p>
            <EmailActivityAcknowledgeButton activityId={activity.id} />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Gmail connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connection ? (
            <>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Before you connect, here&apos;s exactly what this does:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>Read-only.</strong> NextChapter can never send, modify, or delete anything in your
                    mailbox.
                  </li>
                  <li>
                    <strong>What we look at:</strong> the sender, subject line, and date of messages in your Inbox
                    and Sent folder — never the message body.
                  </li>
                  <li>
                    <strong>Why:</strong> so applications, interviews, rejections, offers, and networking notes
                    count toward your grade automatically, without you logging each one by hand.
                  </li>
                </ul>
              </div>
              {isTester ? (
                <Button nativeButton={false} render={<a href="/api/auth/gmail/start" />}>
                  Connect Gmail
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Gmail tracking is in internal testing right now — it&apos;s not yet open to all candidates.
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
                  Your Gmail connection expired (this happens periodically while this feature is in testing).{' '}
                  <a href="/api/auth/gmail/start" className="underline">
                    Reconnect
                  </a>
                  .
                </p>
              )}
              <div className="flex gap-2">
                <EmailActivitySyncButton />
                <form action={disconnectGmail}>
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
              <CardTitle>Job activity detected</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(INBOUND_LABEL).map(([type, label]) => (
                <div key={type} className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{counts[type] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Networking notes sent</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(SENT_LABEL).map(([type, label]) => (
                <div key={type} className="rounded-lg border border-border p-3">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{counts[type] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {needsReview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs review ({needsReview.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  These didn&apos;t match a clear pattern, so nothing was guessed — they don&apos;t count toward
                  your grade yet.
                </p>
                <ul className="space-y-1">
                  {needsReview.slice(0, 10).map((a) => (
                    <li key={a.id} className="text-sm text-muted-foreground">
                      {a.subject || '(no subject)'}
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
