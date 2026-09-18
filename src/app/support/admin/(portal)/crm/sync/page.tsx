import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { getActiveGoogleConnection, getValidAccessToken } from '@/lib/google/connection'
import { getSendAsAddresses } from '@/lib/google/gmail'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateSyncSetting, updateSelfEmails, disconnectAdminGmailInbox } from '../actions'
import { formatDate, sinceLabel } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ googleConnected?: string; googleError?: string; googleErrorDetail?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const [runs, addedAgg, autoLogged, withTouch, totalPeople, needsReview, setting, gmailConnection, calendarConnection] = await Promise.all([
    prisma.crmSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 8 }),
    prisma.crmSyncRun.aggregate({ _sum: { suggested: true } }),
    prisma.crmActivity.count({ where: { isAutoLogged: true, occurredAt: { gte: CRM_ACTIVITY_CUTOFF } } }),
    prisma.crmPerson.count({ where: { lastTouchedAt: { not: null } } }),
    prisma.crmPerson.count(),
    prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
    prisma.crmSyncSetting.findUnique({ where: { id: 'singleton' } }),
    getActiveGoogleConnection(),
    prisma.adminGoogleCalendarConnection.findFirst(),
  ])
  const addedCount = addedAgg._sum.suggested ?? 0
  const token = gmailConnection ? await getValidAccessToken().catch(() => null) : null
  const aliases = token ? await getSendAsAddresses(token).catch(() => []) : []
  const intervalHours = setting?.intervalHours ?? 24
  const enabled = setting?.enabled ?? true

  const lastGmail = runs.find((r) => r.source === 'gmail')
  const lastCalendar = runs.find((r) => r.source === 'calendar')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activity sync</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Email and calendar are swept nightly. Threads involving someone in the CRM are logged;
            someone new is added straight away, flagged for review in Needs Completion rather than
            held in a separate approval queue.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/support/admin/crm/needs-completion" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Review List{needsReview > 0 && ` (${needsReview})`}
          </Link>
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Queue
          </Link>
        </div>
      </header>

      {params.googleConnected && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Google connected — Gmail and Calendar.</p>
      )}
      {params.googleError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>
            Connection failed ({params.googleError}). If this is your first time connecting, make sure this
            Google account is added as a test user on the OAuth consent screen in Google Cloud Console —
            this app is still in Testing publishing status.
          </p>
          {params.googleErrorDetail && (
            <p className="mt-1 font-mono text-xs opacity-80">{params.googleErrorDetail}</p>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">Google</p>
        {gmailConnection && calendarConnection ? (
          <>
            <p className="text-sm text-muted-foreground">
              Gmail connected as <span className="font-medium text-foreground">{gmailConnection.email}</span>
              {gmailConnection.lastSweepAt && <> — last swept {sinceLabel(gmailConnection.lastSweepAt)}</>}
            </p>
            <p className="text-sm text-muted-foreground">
              Calendar connected as <span className="font-medium text-foreground">{calendarConnection.connectedByEmail ?? 'unknown'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              This is the same connection Market Pulse&apos;s research-inbox sweep and Webinar scheduling use —
              disconnecting either one below affects that too.
            </p>
            <div className="flex gap-3">
              <form action={disconnectAdminGmailInbox}>
                <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">Disconnect Gmail</button>
              </form>
              <a href="/support/admin/webinars" className="text-sm text-muted-foreground underline underline-offset-4">
                Manage Calendar connection
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {gmailConnection ? 'Gmail connected, Calendar isn’t' : calendarConnection ? 'Calendar connected, Gmail isn’t' : 'Not connected'}
              {' — email and meeting activity can’t be swept until both are.'}
            </p>
            <a
              href="/api/google/oauth/start?from=/support/admin/crm/sync"
              className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Connect Google
            </a>
            <p className="text-xs text-muted-foreground">One click grants both Gmail (read-only) and Calendar access.</p>
          </>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">What is stored:</strong> who was on the thread, the subject, the
        direction, the time, and the full message. Mail with candidates, coaches and recruiters is skipped entirely:
        those are product relationships with their own records, and they have no business in a
        business-development tool.
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Auto-logged activities" value={autoLogged.toLocaleString()} />
        <Stat label="People with a real last-contact" value={`${withTouch.toLocaleString()} / ${totalPeople.toLocaleString()}`} />
        <Stat label="Added by sync" value={addedCount.toLocaleString()} />
        <Stat label="Awaiting review" value={needsReview.toLocaleString()} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">How often it runs</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          The job wakes hourly and sweeps only when one is due, so changing this takes effect immediately
          rather than needing a deploy. The look-back window widens with the interval, so nothing falls
          between two sweeps.
        </p>
        <form action={updateSyncSetting} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
          {/* Three discrete options -> adjacent radios, per design-principles.md. */}
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Interval</legend>
            <div className="flex flex-wrap gap-4">
              {[
                { h: 1, label: 'Hourly' },
                { h: 24, label: 'Daily' },
                { h: 168, label: 'Weekly' },
              ].map((o) => (
                <label key={o.h} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="intervalHours" value={o.h} defaultChecked={intervalHours === o.h} />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={enabled} />
            Sweeping is on
          </label>
          <SubmitButton size="sm" pendingLabel="Saving…">Save schedule</SubmitButton>
        </form>
      </section>

      {/* Mail forwarded in from one of your own addresses is yours, not a
          conversation with someone. Aliases come from Gmail; this covers
          the forwarding-only ones Gmail doesn't list. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your addresses</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mail to or from any of these is treated as you — never logged as correspondence, and never
          turned into a person. Saving also removes any record already made for one of them.
        </p>
        {aliases.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 font-medium">From Gmail (send-as aliases)</p>
            <p className="flex flex-wrap gap-1.5">
              {aliases.map((a) => (
                <span key={a} className="rounded bg-muted px-2 py-0.5 text-xs">{a}</span>
              ))}
            </p>
          </div>
        )}
        <form action={updateSelfEmails} className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Other addresses that forward to you</span>
            <textarea
              name="selfEmails" rows={3}
              defaultValue={(setting?.selfEmails ?? []).join('\n')}
              placeholder={'you@alumni.school.edu\nyou@old-company.com'}
              className="w-full max-w-lg rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
            />
          </label>
          <SubmitButton size="sm" pendingLabel="Saving…">Save addresses</SubmitButton>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Last runs</h2>
        {runs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            The sweep has never run. It is scheduled daily at 06:00 UTC; until then this page will look
            empty — which is different from a sweep that ran and matched nothing.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span>
                  <span className="font-medium capitalize">{r.source}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.scanned} scanned · {r.matched} matched · {r.activitiesCreated} logged
                    {r.suggested > 0 && ` · ${r.suggested} proposed`}
                    {r.skippedInternal > 0 && ` · ${r.skippedInternal} skipped as internal`}
                  </span>
                  {r.error && <span className="mt-0.5 block text-xs text-destructive">{r.error}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.startedAt)} · {r.finishedAt ? 'finished' : 'did not finish'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(lastGmail || lastCalendar) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Gmail last swept {lastGmail ? sinceLabel(lastGmail.startedAt) : 'never'} · calendar{' '}
            {lastCalendar ? sinceLabel(lastCalendar.startedAt) : 'never'}.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Someone the sweep doesn&apos;t recognize is added directly rather than held for approval here — review
        them in{' '}
        <Link href="/support/admin/crm/needs-completion" className="text-foreground underline">Review List</Link>,
        where a real duplicate or an unlikely-looking name is flagged for you automatically.
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}
