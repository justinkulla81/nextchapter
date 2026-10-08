import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { CADENCE_LABEL } from '@/lib/mailing/cadence'
import { createEdition } from './actions'

export const maxDuration = 30

const STATUS_LABEL = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENDING: 'Sending', SENT: 'Sent' } as const
const STATUS_CLASS = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-brand/10 text-brand',
  SENDING: 'bg-orange/15 text-orange',
  SENT: 'bg-success/10 text-success',
} as const

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/** Admin → CRM → Mailing lists: every list, its sends, and what needs doing. */
export default async function MailingHomePage() {
  await requireAdmin()
  const fiveDaysAgo = daysAgo(5)
  const [lists, editions, pendingPrompts, unsubs, oldUnsubs] = await Promise.all([
    prisma.mailingList.findMany({
      where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.mailingEdition.findMany({
      orderBy: { createdAt: 'desc' }, take: 60,
      include: { lists: { select: { listId: true } }, _count: { select: { recipients: { where: { status: 'SENT' } } } } },
    }),
    prisma.mailingListPrompt.count({ where: { status: 'PENDING' } }),
    prisma.mailingUnsubscribeRequest.count({ where: { processedAt: null } }),
    prisma.mailingUnsubscribeRequest.count({ where: { processedAt: null, receivedAt: { lt: fiveDaysAgo } } }),
  ])
  // Drafts the cadence job made that haven't been approved yet.
  const awaiting = editions.filter((e) => e.status === 'DRAFT' && e.cadenceListId)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mailing lists</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Each list has a cadence and a default readership. When a send is due a prefilled draft appears here and you get an email;
            tailor who gets it, check the text, and approve. Nothing goes out without your approval.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/support/admin/crm/mailing/queue" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Add to a list?{pendingPrompts > 0 && <span className="ml-1.5 rounded-full bg-orange/20 px-1.5 text-xs font-semibold text-orange">{pendingPrompts}</span>}
          </Link>
          <Link href="/support/admin/crm/mailing/unsubscribes" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Process unsubscribes{unsubs > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs font-semibold ${oldUnsubs > 0 ? 'bg-destructive/15 text-destructive' : 'bg-orange/20 text-orange'}`}>{unsubs}</span>}
          </Link>
          <Link href="/support/admin/crm/mailing/lists" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Lists and sender settings
          </Link>
        </nav>
      </header>

      {oldUnsubs > 0 && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {oldUnsubs} unsubscribe {oldUnsubs === 1 ? 'reply has' : 'replies have'} waited more than 5 days. They must be applied within 10 business days.{' '}
          <Link href="/support/admin/crm/mailing/unsubscribes" className="font-medium underline">Process them</Link>
        </p>
      )}

      {awaiting.length > 0 && (
        <section className="space-y-2 rounded-lg border border-orange/40 bg-orange/5 p-4">
          <h2 className="font-semibold">Waiting for your approval ({awaiting.length})</h2>
          <p className="text-xs text-muted-foreground">Prefilled from the last send and this period&apos;s data. Open one to check the text and the readership, then approve it.</p>
          <ul className="divide-y divide-border text-sm">
            {awaiting.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link href={`/support/admin/crm/mailing/editions/${e.id}`} className="font-medium text-brand hover:underline">{e.title}</Link>
                <span className="text-xs text-muted-foreground">{e.subject || 'No subject yet'}</span>
                <span className="ml-auto text-xs text-muted-foreground">Drafted {e.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        {lists.map((list) => {
          const own = editions.filter((e) => e.lists.some((l) => l.listId === list.id))
          return (
            <div key={list.id} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="font-semibold">{list.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {CADENCE_LABEL[list.cadence]} ·{' '}
                    <Link href={`/support/admin/crm/mailing/lists/${list.id}`} className="hover:underline">
                      {list._count.members.toLocaleString()} {list._count.members === 1 ? 'person' : 'people'} on the default readership
                    </Link>
                    {list.audience ? ` · ${list.audience}` : ''}
                  </p>
                </div>
                <form action={createEdition}>
                  <input type="hidden" name="listId" value={list.id} />
                  <SubmitButton size="sm" pendingLabel="Drafting…" variant="outline">
                    Draft a send now
                  </SubmitButton>
                </form>
              </div>
              {own.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Nothing sent to this list yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {own.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                      <Link href={`/support/admin/crm/mailing/editions/${e.id}`} className="font-medium text-brand hover:underline">{e.title}</Link>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                      {e.lists.length > 1 && <span className="text-xs text-muted-foreground">+{e.lists.length - 1} more {e.lists.length === 2 ? 'list' : 'lists'}</span>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {e.sentAt ? `Sent ${e.sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${e._count.recipients}`
                          : e.status === 'SENDING' ? `${e._count.recipients} sent so far`
                          : e.scheduledAt ? `For ${e.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : `Started ${e.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      {lists.length > 1 && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">One email to several lists</h2>
          <p className="mb-3 text-xs text-muted-foreground">Someone on more than one of these gets it once.</p>
          <form action={createEdition} className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              {lists.map((l) => (
                <label key={l.id} className="flex items-center gap-1.5">
                  <input type="checkbox" name="listId" value={l.id} /> {l.name}
                </label>
              ))}
            </div>
            <SubmitButton size="sm" variant="outline" pendingLabel="Starting…">Draft a send to the ticked lists</SubmitButton>
          </form>
        </section>
      )}
    </div>
  )
}
