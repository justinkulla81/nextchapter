import type { Metadata } from 'next'
import type { EmailActivityType } from '@prisma/client'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'
import { isCalendarTrackingTester } from '@/lib/calendar-tracking/google-calendar-oauth'
import { syncGmailConnection } from '@/lib/email-tracking/sync-gmail'
import { syncGoogleCalendarConnection } from '@/lib/calendar-tracking/sync-google-calendar'
import { getActivityReconciliation } from '@/lib/weekly/activity-reconciliation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { NetworkComfortCheck } from '@/components/dashboard/NetworkComfortCheck'
import { GoogleConnectPrompt } from '@/components/dashboard/GoogleConnectPrompt'
import { NetworkQuickActionsCard } from '@/components/dashboard/NetworkQuickActionsCard'
import { ContactRow } from '@/components/dashboard/ContactRow'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { OutreachPlanCard } from '@/components/dashboard/OutreachPlanCard'
import { OutreachCheatSheetCard } from '@/components/dashboard/OutreachCheatSheetCard'
import { GuideCard } from '@/components/dashboard/GuideCard'
import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'
import { TrackingTabs } from '@/components/dashboard/TrackingTabs'
import { EmailActivitySyncButton } from '@/components/dashboard/EmailActivityControls'
import { CalendarActivitySyncButton } from '@/components/dashboard/CalendarActivityControls'
import { disconnectGmail } from '@/app/dashboard/email-activity/actions'
import { disconnectCalendar } from '@/app/dashboard/calendar-activity/actions'
import { fillHelpScriptTemplate } from '@/lib/constants/help-script-template'
import { NETWORK_CSV_AI_PROMPT_TEMPLATE } from '@/lib/constants/network-ai-prompt-template'
import { GUIDES } from '@/lib/constants/guides'
import { markAskedForHelp } from '@/app/dashboard/actions'
import {
  fillIntroRequestTemplate,
  fillGoodWordTemplate,
  fillCheckingInTemplate,
} from '@/lib/constants/network-email-templates'

export const metadata: Metadata = { title: 'Outreach Contacts' }

const CATEGORY_ORDER = [
  'FORMER_COLLEAGUE',
  'HIRING_CONNECTION',
  'OWES_A_FAVOR',
  'RECENT_TRANSITION',
  'COULD_HELP_IN_RETURN',
  null,
] as const

const CATEGORY_LABEL: Record<string, string> = {
  FORMER_COLLEAGUE: 'Former colleagues who respected your work',
  HIRING_CONNECTION: 'People who hire at your level, or know people who do',
  OWES_A_FAVOR: 'People who owe you a favor or would take a call',
  RECENT_TRANSITION: "People who've made a successful transition recently",
  COULD_HELP_IN_RETURN: 'People you could genuinely help in return',
}

// Mirrors activity-reconciliation.ts's NETWORKING_EMAIL_TYPES.
const NETWORKING_EMAIL_TYPES: EmailActivityType[] = [
  'THANK_YOU',
  'FOLLOW_UP',
  'CHECK_IN',
  'INTRO_REQUEST',
  'NETWORKING_OUTREACH',
]

const SENT_LABEL: Record<string, string> = {
  THANK_YOU: 'Thank-you notes',
  FOLLOW_UP: 'Follow-up notes',
  CHECK_IN: 'Check-in notes',
  INTRO_REQUEST: 'Intro/connection requests',
  NETWORKING_OUTREACH: 'Networking outreach messages',
}

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

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ gmailConnected?: string; gmailError?: string; calendarConnected?: string; calendarError?: string }>
}) {
  const profile = await getDashboardData()
  const params = await searchParams
  const [contacts, emailConnection, calendarConnection, emailTester, calendarTester] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    prisma.calendarConnection.findFirst({ where: { candidateId: profile.id, disconnectedAt: null } }),
    profile.email ? isGmailTrackingTester(profile.email) : false,
    profile.email ? isCalendarTrackingTester(profile.email) : false,
  ])

  // Auto-syncs on every visit instead of requiring the manual buttons below —
  // both sync functions self-throttle to once per 5 minutes. Awaited
  // inline (not deferred) so a real send/meeting shows up on the very next
  // refresh — both sync functions now batch their "already tracked?" check
  // into one query instead of one per message/event, so the common case
  // (0-2 genuinely new items) stays fast even though this blocks render.
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
      ? prisma.trackedEmailActivity.findMany({ where: { candidateId: profile.id }, orderBy: { detectedAt: 'desc' } })
      : Promise.resolve([]),
    calendarConnection
      ? prisma.trackedCalendarEvent.findMany({ where: { candidateId: profile.id }, orderBy: { startTime: 'desc' } })
      : Promise.resolve([]),
    emailConnection || calendarConnection ? getActivityReconciliation(profile.id) : Promise.resolve(null),
  ])

  // Job-application-related counts (confirmations, rejections, offers,
  // interview invites) live on the Find Full-Time Jobs page instead — this
  // page only tracks the networking-shaped sent-mail categories below.
  const emailCounts = emailActivities.reduce<Record<string, number>>((acc, a) => {
    acc[a.activityType] = (acc[a.activityType] ?? 0) + 1
    return acc
  }, {})

  const interviewCount = calendarEvents.filter((e) => e.eventType === 'INTERVIEW').length
  const calendarNetworkingCount = calendarEvents.filter((e) => e.eventType === 'NETWORKING_CALL').length

  const networkingEmailCount = emailActivities.filter(
    (a) => a.direction === 'OUTBOUND' && NETWORKING_EMAIL_TYPES.includes(a.activityType)
  ).length

  const scriptContext = {
    candidateFirstName: profile.firstName,
    targetRoleType: profile.targetRoleType,
    knownFor: profile.knownFor,
  }

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')

  if (!profile.networkComfortLevel) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outreach Contacts</h1>
          <p className="mt-1 text-muted-foreground">
            Networking is the single highest-leverage thing you can do in a search — most roles get
            filled through a connection, not a cold application. It also happens to be the part most
            people avoid the longest.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <NetworkComfortCheck />
        </div>
      </div>
    )
  }

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
                  <strong>What we look at:</strong> the sender, subject line, and date of messages in your Inbox
                  and Sent folder — never the message body.
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
            <div className="mt-2 flex gap-2">
              <EmailActivitySyncButton />
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach Contacts</h1>
        <p className="mt-1 text-muted-foreground">
          The people most likely to help you find your next role probably aren&apos;t your closest
          friends — they&apos;re the people you sort of know. This is the highest-leverage work in
          your search; don&apos;t let it sit untouched.
        </p>
        <SprintActionCompletion
          candidateId={profile.id}
          actionTypes={['NETWORKING_LIST', 'OUTREACH_MESSAGE', 'OUTREACH_CALL', 'FOLLOW_UP_NOTE_SENT']}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Networking Stats</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(SENT_LABEL).map(([type, label]) => (
            <div key={type} className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold text-foreground tabular-nums">{emailCounts[type] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <NetworkQuickActionsCard contacts={contacts} />

      <GoogleConnectPrompt candidateId={profile.id} email={profile.email} />

      <OutreachPlanCard
        concerns={profile.networkingConcerns}
        connectPreferences={profile.networkConnectPreferences}
        comfortLevel={profile.networkComfortLevel}
        dismissedAlready={Boolean(profile.outreachPlanDismissedAt)}
      />

      {/* Steps 1-3 are one workflow: export → clean up → import. The
          connecting line + numbered circles below are the only thing that
          changed visually from three separate cards — same components,
          wrapped in a positioned container so the "why" captions and
          connector read as one continuous task. */}
      <div id="import">
        <h2 className="text-lg font-semibold">Build your list from LinkedIn</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three steps, about 15 minutes total. You don&apos;t need to be technical for any of this —
          just follow along in order.
        </p>
        <div className="relative mt-4 space-y-6 border-l-2 border-border pl-6">
          <div className="relative">
            <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              1
            </span>
            <div className="space-y-2 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Export your LinkedIn connections</h3>
              <p className="text-sm text-muted-foreground">
                Settings &amp; Privacy → Data Privacy → Get a copy of your data → Connections →
                Request archive. LinkedIn emails you a download link within 10-24 minutes.
              </p>
              <p className="text-xs text-muted-foreground">
                Why: this pulls in everyone you&apos;re connected to at once, instead of adding
                people one at a time.
              </p>
            </div>
          </div>

          <div className="relative">
            <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              2
            </span>
            <CopyableTemplateCard
              title="Clean it up with AI (optional but worth it)"
              description="Paste your exported CSV into ChatGPT or Claude with this prompt to get it cleaned up and prioritized before you import it below."
              template={NETWORK_CSV_AI_PROMPT_TEMPLATE}
              templateType="csv_cleanup_prompt"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Why: your export includes everyone you&apos;ve ever connected with — this step
              surfaces the people actually worth reaching out to first.
            </p>
          </div>

          <div className="relative">
            <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              3
            </span>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium text-foreground">Import the file</h3>
              <CsvImportForm />
              <p className="text-xs text-muted-foreground">
                Why: this is what turns a spreadsheet into an actual, workable list below — with
                outreach scripts ready for each person.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Your contacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every contact you add and outreach you log counts toward the connecting signal in your
            Market Reality Grade.
          </p>
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contacts yet — import your LinkedIn connections above to get started.
          </p>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const categoryContacts = contacts.filter((c) => c.category === category)
            if (categoryContacts.length === 0) return null
            return (
              <div key={category ?? 'uncategorized'} className="space-y-3">
                <h3 className="text-base font-medium text-foreground">
                  {category ? CATEGORY_LABEL[category] : 'Uncategorized — sort these into a category'}
                </h3>
                <div className="space-y-3">
                  {categoryContacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      networkingConcerns={profile.networkingConcerns}
                      scriptContext={scriptContext}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Scripts &amp; templates</h2>
        {networkScriptsGuide && <GuideCard guide={networkScriptsGuide} unlocked />}
        <OutreachCheatSheetCard />
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Ready-to-send templates</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CopyableTemplateCard
              title="Ask someone for help"
              description="Pick one person from your list above and send this."
              template={fillHelpScriptTemplate(profile)}
              templateType="ask_for_help"
              onCopy={markAskedForHelp}
            />
            <CopyableTemplateCard
              title="Asking for an intro"
              template={fillIntroRequestTemplate(profile)}
              templateType="intro_request"
            />
            <CopyableTemplateCard
              title="Putting in a good word"
              template={fillGoodWordTemplate(profile)}
              templateType="good_word"
            />
            <CopyableTemplateCard
              title="Checking in about interim work"
              template={fillCheckingInTemplate(profile)}
              templateType="checking_in"
            />
          </div>
        </div>
      </div>

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
    </div>
  )
}
