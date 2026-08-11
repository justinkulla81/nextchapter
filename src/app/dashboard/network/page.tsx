import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import type { EmailActivityType } from '@prisma/client'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'
import { isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { extractEmailAddress } from '@/lib/email-tracking/email-address'
import { getActivityReconciliation } from '@/lib/weekly/activity-reconciliation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { NetworkComfortCheck } from '@/components/dashboard/NetworkComfortCheck'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { NetworkQuickActionsCard } from '@/components/dashboard/NetworkQuickActionsCard'
import { NetworkStatTile, type StatTileItem } from '@/components/dashboard/NetworkStatTile'
import { BackchannelMatchesCard } from '@/components/dashboard/BackchannelMatchesCard'
import { MarkBackchannelViewedOnMount } from '@/components/dashboard/MarkBackchannelViewedOnMount'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { getBackchannelMatches } from '@/lib/network/backchannel'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { NeedsFollowUpCard } from '@/components/dashboard/NeedsFollowUpCard'
import { OutreachPlanCard } from '@/components/dashboard/OutreachPlanCard'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
import { TrackingTabs } from '@/components/dashboard/TrackingTabs'
import { EmailActivitySyncButton, EmailActivityForceResyncButton } from '@/components/dashboard/EmailActivityControls'
import { CalendarActivitySyncButton } from '@/components/dashboard/CalendarActivityControls'
import { disconnectGmail } from '@/app/dashboard/email-activity/actions'
import { disconnectCalendar } from '@/app/dashboard/calendar-activity/actions'

export const metadata: Metadata = { title: 'Network with My Contacts' }

// Mirrors activity-reconciliation.ts's NETWORKING_EMAIL_TYPES.
const NETWORKING_EMAIL_TYPES: EmailActivityType[] = [
  'THANK_YOU',
  'FOLLOW_UP',
  'CHECK_IN',
  'INTRO_REQUEST',
  'NETWORKING_OUTREACH',
]


function ErrorBanner({ code, kind }: { code: string; kind: 'gmail' | 'calendar' }) {
  const label = kind === 'gmail' ? 'Gmail' : 'Calendar'
  const message =
    code === 'not_a_tester'
      ? `${label} tracking is in internal testing right now — your account isn't on the tester list yet.`
      : code === 'not_logged_in'
        ? 'Please log in first.'
        : code === 'no_refresh_token' || code === 'exchange_failed'
          ? 'Something went wrong connecting — please try again.'
          : code === 'not_configured'
            ? `${label} connection is not available right now.`
            : code === 'denied'
              ? "Connection wasn't completed."
              : null
  if (!message) return null
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>
  )
}

type NetworkSearchParams = {
  gmailConnected?: string
  gmailError?: string
  calendarConnected?: string
  calendarError?: string
}

// A contact counts as job-relevant two ways: manually flagged as able to
// help with a specific application (helpfulForJobs — the "Who can help"
// section on the Jobs page), or their company on file matches a job the
// candidate has applied to, is interviewing for, or is otherwise actively
// tracking (any JobPosting row means the candidate checked its fit or
// applied — both read as "interested in this company"). Case-insensitive
// match since CSV-imported company names and JobPosting.companyName rarely
// share exact casing.
async function getJobRelevantContactEmails(candidateId: string): Promise<Set<string>> {
  const [contacts, jobPostings] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId, removedAt: null, email: { not: null } },
      select: { email: true, company: true, helpfulForJobs: { select: { id: true } } },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId, companyName: { not: null } },
      select: { companyName: true },
    }),
  ])
  const jobCompanies = new Set(jobPostings.map((j) => j.companyName!.toLowerCase().trim()))
  const emails = new Set<string>()
  for (const contact of contacts) {
    if (!contact.email) continue
    const isFlaggedHelpful = contact.helpfulForJobs.length > 0
    const companyMatches = !!contact.company && jobCompanies.has(contact.company.toLowerCase().trim())
    if (isFlaggedHelpful || companyMatches) emails.add(contact.email.toLowerCase())
  }
  return emails
}

function AutomaticTrackingSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
      <Spinner size={16} />
      Checking your connected Gmail and Calendar…
    </div>
  )
}

// Carries the two heaviest calls on this page — syncGmailConnection and
// syncGoogleCalendarConnection, each a live paginated Gmail/Calendar API
// call with a sequential per-new-item loop inside — in their own Suspense
// boundary. Both self-throttle to once per 5 minutes and batch their
// "already tracked?" check into one query, so the common case (0-2 new
// items) is fast, but a candidate returning after a while with several new
// messages/events used to block the ENTIRE page (contacts, backchannel
// matches, quick actions, needs-follow-up) behind this. Now only the
// Networking Stats + Automatic Tracking sections themselves wait on it.
async function AutomaticTrackingSection({
  profile,
  params,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  params: NetworkSearchParams
}) {
  const [emailConnection, calendarConnection, emailTester, calendarTester, jobRelevantContactEmails] = await Promise.all([
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    profile.email ? isGmailTrackingTester(profile.email) : false,
    profile.email ? isCalendarTrackingTester(profile.email) : false,
    getJobRelevantContactEmails(profile.id),
  ])

  // Auto-syncs on every visit instead of requiring the manual buttons below —
  // both sync functions self-throttle to once per 5 minutes.
  await Promise.all([
    emailConnection
      ? syncGmailConnection(emailConnection.id).catch((error) => console.error('Email auto-sync failed:', error))
      : null,
    calendarConnection
      ? syncGoogleCalendarConnection(calendarConnection.id).catch((error) =>
          console.error('Calendar auto-sync failed:', error)
        )
      : null,
  ])

  const [emailActivities, calendarEvents, reconciliation] = await Promise.all([
    emailConnection
      ? prisma.trackedEmailActivity.findMany({
          where: { candidateId: profile.id, dismissedAt: null },
          orderBy: { detectedAt: 'desc' },
        })
      : Promise.resolve([]),
    calendarConnection
      ? prisma.trackedCalendarEvent.findMany({
          where: { candidateId: profile.id, dismissedAt: null },
          orderBy: { startTime: 'desc' },
        })
      : Promise.resolve([]),
    emailConnection || calendarConnection ? getActivityReconciliation(profile.id) : Promise.resolve(null),
  ])

  // Job-application-related counts (confirmations, rejections, offers,
  // interview invites) live on the Find Full-Time Jobs page instead — this
  // page only tracks the networking-shaped sent-mail categories below.
  const interviewCount = calendarEvents.filter((e) => e.eventType === 'INTERVIEW').length
  const calendarNetworkingCount = calendarEvents.filter((e) => e.eventType === 'NETWORKING_CALL').length

  const networkingEmailCount = emailActivities.filter(
    (a) => a.direction === 'OUTBOUND' && NETWORKING_EMAIL_TYPES.includes(a.activityType)
  ).length

  const emailItem = (a: (typeof emailActivities)[number]): StatTileItem => ({
    id: a.id,
    kind: 'email',
    label: a.subject || (a.companyName ? `Email — ${a.companyName}` : 'Email'),
    date: a.detectedAt,
  })
  const calendarItem = (e: (typeof calendarEvents)[number]): StatTileItem => ({
    id: e.id,
    kind: 'calendar',
    label: e.title || 'Calendar event',
    date: e.startTime,
  })

  // THANK_YOU, FOLLOW_UP, and CHECK_IN are shown as one combined stat — all
  // three are the same real-world action ("reached back out to someone"),
  // just different phrasing, so tracking them as separate tiles only
  // fragmented one number into three.
  const followUpOrThankYouItems = emailActivities.filter((a) =>
    (['FOLLOW_UP', 'CHECK_IN', 'THANK_YOU'] as const).includes(
      a.activityType as 'FOLLOW_UP' | 'CHECK_IN' | 'THANK_YOU'
    )
  )
  const resumesSharedItems = emailActivities.filter((a) => a.direction === 'OUTBOUND' && a.hasResumeAttachment)
  const introRequestItems = emailActivities.filter((a) => a.activityType === 'INTRO_REQUEST')
  // High-confidence only — NETWORKING_OUTREACH's low-confidence bucket is
  // bare generic keywords ("help", "job", "next chapter") that show up in
  // plenty of unrelated mail (including this app's own emails), so it's
  // tracked internally but never surfaced as a confident detection here.
  const networkingOutreachItems = emailActivities.filter(
    (a) => a.activityType === 'NETWORKING_OUTREACH' && a.confidence === 'high'
  )
  const networkingCallItems = calendarEvents.filter((e) => e.eventType === 'NETWORKING_CALL')

  // Same networking-type filter as the tiles above, but scoped to contacts
  // tied to a specific job — someone at a company the candidate applied to,
  // is interviewing at, or has flagged as able to help — rather than
  // networking in general. jobRelevantContactEmails is computed once at the
  // top of the page (before this Suspense boundary) so it's available even
  // though only the on-page-load-fast query set lives up there.
  const jobFollowUpItems = emailActivities.filter(
    (a) =>
      a.direction === 'OUTBOUND' &&
      NETWORKING_EMAIL_TYPES.includes(a.activityType) &&
      jobRelevantContactEmails.has(extractEmailAddress(a.fromAddress ?? '').toLowerCase())
  )

  const networkingStatTiles = [
    { label: 'Follow-up / thank-you notes', items: followUpOrThankYouItems.map(emailItem) },
    { label: 'Job-related follow-ups', items: jobFollowUpItems.map(emailItem) },
    { label: 'Intro/connection requests', items: introRequestItems.map(emailItem) },
    { label: 'Networking outreach messages', items: networkingOutreachItems.map(emailItem) },
    { label: 'Resumes shared', items: resumesSharedItems.map(emailItem) },
    { label: 'Coffees, lunches & meetings scheduled', items: networkingCallItems.map(calendarItem) },
  ]

  // Deliberately excludes needsReview counts — most unclassified inbox mail
  // and calendar events are just everyday noise (newsletters, personal
  // meetings), not something the candidate needs to act on.
  const emailAlertCount = emailConnection?.needsReconnectAt ? 1 : 0
  const calendarAlertCount = calendarConnection?.needsReconnectAt ? 1 : 0

  const emailContent = (
    <div className="space-y-4">
      {params.gmailError && <ErrorBanner code={params.gmailError} kind="gmail" />}
      {params.gmailConnected && (
        <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Gmail connected — your activity will start showing up here.
        </p>
      )}

      {!emailConnection ? (
        <Card>
          <CardHeader>
            <CardTitle>Gmail connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Before you connect, here&apos;s exactly what this does:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Read-only.</strong> NextChapter can never send, modify, or delete anything in your
                  mailbox.
                </li>
                <li>
                  <strong>What we look at:</strong> the sender, subject line, date, and text of messages in your
                  Inbox and Sent folder — only to detect things like thank-you notes, follow-ups, and application
                  activity. Nothing is ever shown to anyone else.
                </li>
                <li>
                  <strong>Why:</strong> so applications, interviews, rejections, offers, and networking notes
                  count toward your grade automatically, without you logging each one by hand.
                </li>
              </ul>
            </div>
            {emailTester ? (
              <Button nativeButton={false} render={<a href="/api/auth/gmail/start" />}>
                Connect Gmail
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Gmail tracking is in internal testing right now — it&apos;s not yet open to all candidates.
              </p>
            )}
          </CardContent>
        </Card>
      ) : emailConnection.needsReconnectAt ? (
        <Card>
          <CardHeader>
            <CardTitle>Gmail connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Your Gmail connection expired (this happens periodically while this feature is in testing).{' '}
              <a href="/api/auth/gmail/start" className="underline">
                Reconnect
              </a>
              .
            </p>
            <div className="flex gap-2">
              <EmailActivitySyncButton />
              <form action={disconnectGmail}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            Gmail connected
            {emailConnection.lastSyncAt && (
              <span className="text-muted-foreground"> · last checked {emailConnection.lastSyncAt.toLocaleString()}</span>
            )}
            <span className="text-muted-foreground">
              {' '}
              · {networkingEmailCount} networking message{networkingEmailCount === 1 ? '' : 's'} detected
            </span>
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-primary">Manage</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <EmailActivitySyncButton />
              <EmailActivityForceResyncButton />
              <form action={disconnectGmail}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </details>
        </div>
      )}

      {emailConnection && reconciliation?.networkingNote && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          {reconciliation.networkingNote}
        </p>
      )}
    </div>
  )

  const calendarContent = (
    <div className="space-y-4">
      {params.calendarError && <ErrorBanner code={params.calendarError} kind="calendar" />}
      {params.calendarConnected && (
        <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Calendar connected — your activity will start showing up here.
        </p>
      )}

      {!calendarConnection ? (
        <Card>
          <CardHeader>
            <CardTitle>Calendar connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {calendarTester ? (
              <Button nativeButton={false} render={<a href="/api/auth/calendar/start" />}>
                Connect Calendar
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Calendar tracking is in internal testing right now — it&apos;s not yet open to all candidates.
              </p>
            )}
          </CardContent>
        </Card>
      ) : calendarConnection.needsReconnectAt ? (
        <Card>
          <CardHeader>
            <CardTitle>Calendar connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Your calendar connection expired (this happens periodically while this feature is in testing).{' '}
              <a href="/api/auth/calendar/start" className="underline">
                Reconnect
              </a>
              .
            </p>
            <div className="flex gap-2">
              <CalendarActivitySyncButton />
              <form action={disconnectCalendar}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            Calendar connected
            {calendarConnection.lastSyncAt && (
              <span className="text-muted-foreground">
                {' '}
                · last checked {calendarConnection.lastSyncAt.toLocaleString()}
              </span>
            )}
            <span className="text-muted-foreground">
              {' '}
              · {calendarNetworkingCount} networking call{calendarNetworkingCount === 1 ? '' : 's'},{' '}
              {interviewCount} interview{interviewCount === 1 ? '' : 's'} detected
            </span>
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-primary">Manage</summary>
            <div className="mt-2 flex gap-2">
              <CalendarActivitySyncButton />
              <form action={disconnectCalendar}>
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </details>
        </div>
      )}

      {calendarConnection && reconciliation?.interviewNote && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          {reconciliation.interviewNote}
        </p>
      )}
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Networking Stats</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {networkingStatTiles.map((tile) => (
            <NetworkStatTile key={tile.label} label={tile.label} items={tile.items} />
          ))}
        </CardContent>
      </Card>

      {(emailConnection || calendarConnection) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Automatic tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What your connected Gmail and Calendar have picked up automatically.
          </p>
          <TrackingTabs
            emailContent={emailContent}
            calendarContent={calendarContent}
            emailAlertCount={emailAlertCount}
            calendarAlertCount={calendarAlertCount}
            defaultTab={emailAlertCount >= calendarAlertCount ? 'email' : 'calendar'}
          />
        </div>
      )}
    </>
  )
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<NetworkSearchParams>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const [contacts, backchannelMatches, needsFollowUp] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
    }),
    getBackchannelMatches(profile.id, profile.networkBackchannelLastViewedAt),
    getNeedsFollowUpList(profile.id),
  ])

  if (!profile.networkComfortLevel) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Network with My Contacts</h1>
          <PageHeaderBoxes pageKey="network" candidateId={profile.id} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <NetworkComfortCheck />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Network with My Contacts</h1>
        <PageHeaderBoxes
          pageKey="network"
          candidateId={profile.id}
          dailyMessageOverride={
            <OutreachPlanCard
              concerns={profile.networkingConcerns}
              connectPreferences={profile.networkConnectPreferences}
              comfortLevel={profile.networkComfortLevel}
              dismissedAlready={Boolean(profile.outreachPlanDismissedAt)}
            />
          }
        />
      </div>

      <Link
        href="/dashboard/network/contacts?buildList=1#import"
        className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"
      >
        Build Your Networking List ({contacts.length})
      </Link>

      <MarkBackchannelViewedOnMount />
      <ReconnectBanner candidateId={profile.id} />

      <BackchannelMatchesCard matches={backchannelMatches} />

      <NetworkQuickActionsCard contacts={contacts} />

      <NeedsFollowUpCard items={needsFollowUp} />

      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} />

      <Suspense fallback={<AutomaticTrackingSkeleton />}>
        <AutomaticTrackingSection profile={profile} params={params} />
      </Suspense>

      <GuideCallout pageSlot="network" currentJobStatus={profile.currentJobStatus} />
    </div>
  )
}
