import type { Metadata } from 'next'
import { Suspense, cache } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { EmailActivityType, OutreachChannel } from '@prisma/client'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { extractEmailAddress } from '@/lib/email-tracking/email-address'
import { getActivityReconciliation } from '@/lib/weekly/activity-reconciliation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { outreachCountToTier } from '@/lib/network/outreach-count-tier'
import { computeOutreachRelationshipMix } from '@/lib/network/outreach-relationship-mix'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { NetworkQuickActionsCard } from '@/components/dashboard/NetworkQuickActionsCard'
import { NetworkStatTile, type StatTileItem } from '@/components/dashboard/NetworkStatTile'
import { BackchannelMatchesCard } from '@/components/dashboard/BackchannelMatchesCard'
import { AlumniNetworkCarousel } from '@/components/dashboard/AlumniNetworkCarousel'
import { getMatchedAlumniGroups } from '@/lib/network/alumni-groups'
import { MarkBackchannelViewedOnMount } from '@/components/dashboard/MarkBackchannelViewedOnMount'
import { GuideCallout } from '@/components/dashboard/GuideCallout'
import { getBackchannelMatches } from '@/lib/network/backchannel'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { NeedsFollowUpCard } from '@/components/dashboard/NeedsFollowUpCard'
import { PriorityContactsCard } from '@/components/dashboard/PriorityContactsCard'
import { PRIORITY_CONTACT_TARGET_COUNT } from '@/lib/network/priority-contacts'
import { OutreachPlanCard } from '@/components/dashboard/OutreachPlanCard'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { ReconnectBanner } from '@/components/dashboard/ReconnectBanner'
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
  contact?: string
}

const OUTREACH_CHANNEL_LABEL: Record<OutreachChannel, string> = {
  EMAIL: 'Email',
  LINKEDIN: 'LinkedIn',
  PHONE: 'Phone',
  TEXT: 'Text',
  MEETING: 'Meeting',
}

// Modest by design — a plain count-by-channel line, not a full trends
// breakdown like ApplicationTrendsContent on the Find a Job page.
function OutreachBreakdownContent({ logs }: { logs: { channel: OutreachChannel }[] }) {
  const counts = logs.reduce<Partial<Record<OutreachChannel, number>>>((acc, log) => {
    acc[log.channel] = (acc[log.channel] ?? 0) + 1
    return acc
  }, {})
  const entries = (Object.entries(counts) as [OutreachChannel, number][]).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {entries.map(([channel, count]) => (
        <span key={channel} className="text-foreground">
          {OUTREACH_CHANNEL_LABEL[channel]} <span className="text-muted-foreground">({count})</span>
        </span>
      ))}
    </div>
  )
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
//
// Wrapped in cache() so NetworkingStatsCard (top of page) and
// AutomaticTrackingSection (bottom of page) — two separate Suspense
// boundaries so they can sit apart — share one execution of this instead of
// each triggering its own live Gmail/Calendar sync.
const loadAutomaticTrackingData = cache(async function loadAutomaticTrackingData(
  profile: Awaited<ReturnType<typeof getDashboardData>>
) {
  const [emailConnection, calendarConnection, jobRelevantContactEmails] = await Promise.all([
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
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
    { label: 'Catch-up / Coffees / Meetings', items: networkingCallItems.map(calendarItem) },
  ]

  return {
    networkingStatTiles,
    emailConnection,
    calendarConnection,
    reconciliation,
    networkingEmailCount,
    calendarNetworkingCount,
    interviewCount,
  }
})

async function NetworkingStatsCard({ profile }: { profile: Awaited<ReturnType<typeof getDashboardData>> }) {
  const { networkingStatTiles } = await loadAutomaticTrackingData(profile)
  return (
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
  )
}

// Deliberately at the bottom of the page — this is status/plumbing, not
// something that needs top billing on every visit. Each connected service
// collapses to one line ("Gmail connected · last checked ... · N detected")
// and only expands into a full card when it actually needs attention (an
// expired connection). No separate Email/Calendar tab buttons — they only
// ever showed one thing each, so a switcher just added a click. Initial
// connect/pitch UI lives in GoogleConnectPrompt (rendered higher up the
// page), so there's no redundant "before you connect" card down here.
async function AutomaticTrackingSection({
  profile,
  params,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  params: NetworkSearchParams
}) {
  const { emailConnection, calendarConnection, reconciliation, networkingEmailCount, calendarNetworkingCount, interviewCount } =
    await loadAutomaticTrackingData(profile)

  if (!emailConnection && !calendarConnection) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Automatic tracking</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What your connected Gmail and Calendar have picked up automatically.
      </p>
      <div className="space-y-3">
        {params.gmailError && <ErrorBanner code={params.gmailError} kind="gmail" />}
        {params.calendarError && <ErrorBanner code={params.calendarError} kind="calendar" />}
        {(params.gmailConnected || params.calendarConnected) && (
          <p className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
            {params.gmailConnected && params.calendarConnected
              ? 'Gmail and Calendar connected'
              : params.gmailConnected
                ? 'Gmail connected'
                : 'Calendar connected'}{' '}
            — your activity will start showing up here.
          </p>
        )}

        {emailConnection &&
          (emailConnection.needsReconnectAt ? (
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
                  <span className="text-muted-foreground">
                    {' '}
                    · last checked {emailConnection.lastSyncAt.toLocaleString()}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {' '}
                  · {networkingEmailCount} networking message{networkingEmailCount === 1 ? '' : 's'} detected
                </span>
              </p>
              <details className="group text-sm">
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-primary">
                  Manage
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
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
          ))}

        {emailConnection && reconciliation?.networkingNote && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            {reconciliation.networkingNote}
          </p>
        )}

        {calendarConnection &&
          (calendarConnection.needsReconnectAt ? (
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
              <details className="group text-sm">
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-primary">
                  Manage
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
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
          ))}

        {calendarConnection && reconciliation?.interviewNote && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            {reconciliation.interviewNote}
          </p>
        )}
      </div>
    </div>
  )
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<NetworkSearchParams>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const [rawContacts, backchannelMatches, needsFollowUp, outreachLogs, alumniGroups] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id, removedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { outreachLogs: { select: { id: true }, take: 1 } },
    }),
    getBackchannelMatches(profile.id, profile.networkBackchannelLastViewedAt),
    getNeedsFollowUpList(profile.id),
    // Powers the Outreach Log progressive-unlock card below — every manually
    // logged outreach for this candidate, plus the relationship tag(s) of
    // whichever contact it was logged against (null when logged without a
    // specific contact), which feeds the "well-rounded mix" checklist.
    prisma.outreachLog.findMany({
      where: { candidateId: profile.id },
      select: { channel: true, contact: { select: { relationshipTags: true } } },
    }),
    getMatchedAlumniGroups(profile.id),
  ])
  const outreachMix = computeOutreachRelationshipMix(outreachLogs.map((l) => l.contact?.relationshipTags ?? []))
  const contacts = rawContacts.map((c) => ({ ...c, hasReachedOut: c.outreachLogs.length > 0 }))
  // Drops off this list the moment an outreach is logged against them — see
  // toggleContactPriority's comment for why (they belong in Needs a
  // Follow-up from then on instead).
  const priorityContacts = contacts.filter((c) => c.isPriority && !c.hasReachedOut)
  const starredCount = contacts.filter((c) => c.priorityPointsAwardedAt).length

  if (!profile.networkComfortLevel) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Network with My Contacts</h1>
          <PageHeaderBoxes pageKey="network" candidateId={profile.id} />
        </div>
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-medium text-foreground">Answer Networking Willingness on Search Strategy first</p>
          <p className="mt-1 text-muted-foreground">
            How comfortable you are letting your network know you&apos;re searching now lives on
            Search Strategy so you only answer it once, alongside your outreach target and
            concerns — it also calibrates the scripts we give you.
          </p>
          <Link
            href="/dashboard/search-strategy"
            className="mt-2 inline-block text-sm text-primary underline underline-offset-4"
          >
            Go to Search Strategy →
          </Link>
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
          lifetimeProgress={{
            CONTACT_PRIORITIZED: { current: starredCount, target: PRIORITY_CONTACT_TARGET_COUNT },
          }}
        />
      </div>

      <Suspense fallback={<AutomaticTrackingSkeleton />}>
        <NetworkingStatsCard profile={profile} />
      </Suspense>

      <Link
        href="/dashboard/network/contacts?buildList=1#import"
        className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"
      >
        Go to / Add to Networking List ({contacts.length.toLocaleString()})
      </Link>

      <MarkBackchannelViewedOnMount />
      <ReconnectBanner candidateId={profile.id} />

      <PriorityContactsCard contacts={priorityContacts} />

      <NeedsFollowUpCard items={needsFollowUp} />

      {outreachLogs.length > 0 && (
        <TierSummaryCard
          title="Outreach Log"
          count={outreachLogs.length}
          unitLabel="touchpoint"
          tier={outreachCountToTier(outreachLogs.length)}
          buildingAt={3}
          highAt={5}
          unlockedContent={<OutreachBreakdownContent logs={outreachLogs} />}
          mixTitle="A well-rounded outreach mix"
          mixItems={[
            { label: 'A hiring connection (recruiter or hiring manager)', done: outreachMix.hasHiringConnection },
            {
              label: 'Someone who knows your work (former colleague, professional contact, classmate)',
              done: outreachMix.hasProfessionalContact,
            },
            { label: 'Personal support (coach, friend, or someone helping you)', done: outreachMix.hasPersonalSupport },
          ]}
        />
      )}

      <BackchannelMatchesCard matches={backchannelMatches} />

      <AlumniNetworkCarousel groups={alumniGroups} />

      <NetworkQuickActionsCard contacts={contacts} initialContactId={params.contact} />

      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} />

      <GuideCallout pageSlot="network" currentJobStatus={profile.currentJobStatus} />

      <Suspense fallback={<AutomaticTrackingSkeleton />}>
        <AutomaticTrackingSection profile={profile} params={params} />
      </Suspense>
    </div>
  )
}
