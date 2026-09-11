import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { acceptSuggestedContact, ignoreSuggestedContact } from '../actions'
import { formatDate, sinceLabel } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmSyncPage() {
  await requireAdmin()

  const [runs, pending, addedCount, ignoredCount, autoLogged, withTouch, totalPeople] = await Promise.all([
    prisma.crmSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 8 }),
    prisma.crmSuggestedContact.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ messageCount: 'desc' }, { lastSeenAt: 'desc' }],
      take: 60,
    }),
    prisma.crmSuggestedContact.count({ where: { status: 'ADDED' } }),
    prisma.crmSuggestedContact.count({ where: { status: 'IGNORED' } }),
    prisma.crmActivity.count({ where: { isAutoLogged: true } }),
    prisma.crmPerson.count({ where: { lastTouchedAt: { not: null } } }),
    prisma.crmPerson.count(),
  ])

  const lastGmail = runs.find((r) => r.source === 'gmail')
  const lastCalendar = runs.find((r) => r.source === 'calendar')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activity sync</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Email and calendar are swept nightly. Threads involving someone in the CRM are logged; people
            who write often but aren&apos;t in it yet are proposed below rather than added.
          </p>
        </div>
        <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Queue
        </Link>
      </header>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">What is stored:</strong> who was on the thread, the subject, the
        direction, the time, and roughly the first 200 characters. Message bodies are never fetched — the
        request asks Gmail for metadata only. Mail with candidates, coaches and recruiters is skipped entirely:
        those are product relationships with their own records, and they have no business in a
        business-development tool.
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Auto-logged activities" value={autoLogged.toLocaleString()} />
        <Stat label="People with a real last-contact" value={`${withTouch.toLocaleString()} / ${totalPeople.toLocaleString()}`} />
        <Stat label="Contacts added from mail" value={addedCount.toLocaleString()} />
        <Stat label="Dismissed" value={ignoredCount.toLocaleString()} />
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

      <section>
        <h2 className="mb-1 text-lg font-semibold">People who write to you but aren&apos;t in the CRM</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Sorted by how often they appear. An address in your inbox is evidence of contact, not of a business
          relationship — so nothing here is added until you say so, and anything dismissed stays dismissed.
        </p>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nothing waiting. Either every frequent correspondent is already in the CRM, or the sweep has not
            run yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {s.displayName ?? s.email}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                      {s.messageCount} {s.messageCount === 1 ? 'message' : 'messages'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                  {s.lastSubject && <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.lastSubject}</p>}
                </div>
                {/* Two discrete outcomes -> adjacent buttons, per design-principles.md. */}
                <div className="flex shrink-0 gap-2">
                  <form action={acceptSuggestedContact.bind(null, s.id)}>
                    <SubmitButton size="sm" pendingLabel="Adding…">Add to CRM</SubmitButton>
                  </form>
                  <form action={ignoreSuggestedContact.bind(null, s.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Dismissing…">Not a contact</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
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
