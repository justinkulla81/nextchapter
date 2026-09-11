import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmBroadcastSend } from '@/components/admin/CrmBroadcastSend'
import { resolveSegment } from '@/lib/crm/segments'
import { excludeFromSegment, includeInSegment, stageBroadcast, deleteBroadcast } from '../actions'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 60

export default async function CrmSegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const segment = await prisma.crmSegment.findUnique({ where: { id } })
  if (!segment) notFound()

  const [{ kind, recipients }, broadcasts] = await Promise.all([
    resolveSegment(id),
    prisma.crmBroadcast.findMany({
      where: { segmentId: id }, orderBy: { createdAt: 'desc' }, take: 10,
      include: { _count: { select: { recipients: true } } },
    }),
  ])

  const live = recipients.filter((r) => !r.excluded)
  const excluded = recipients.filter((r) => r.excluded)
  const staged = broadcasts.find((b) => !b.sentAt)
  const stage = stageBroadcast.bind(null, id)

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/segments" className="text-muted-foreground hover:underline">← All segments</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">{segment.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {kind === 'DYNAMIC'
            ? 'Re-evaluates every time it is opened, so this list is current as of now.'
            : 'Fixed list — membership was frozen when the segment was created.'}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Will receive" value={String(live.length)} />
        <Stat label="Removed by hand" value={String(excluded.length)} />
        <Stat label="Updates sent" value={String(broadcasts.filter((b) => b.sentAt).length)} />
      </section>

      {live.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nobody matches this segment right now. Only people with an email address are ever included, and
          most CRM records still have none — that is expected until the activity sweep has discovered some.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Recipients ({live.length})</h2>
        <ul className="max-h-96 overflow-auto rounded-lg border border-border divide-y divide-border text-sm">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
              <span className="min-w-0">
                <Link href={`/support/admin/crm/people/${r.id}`} className="font-medium hover:underline">{r.fullName}</Link>
                {r.org && <span className="ml-1.5 text-xs text-muted-foreground">{r.org}</span>}
                <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
              </span>
              <form action={excludeFromSegment.bind(null, id, r.id)}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">Remove</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {excluded.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Removed ({excluded.length})</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Kept with the segment, so a removal is not lost the next time it re-evaluates.
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {excluded.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-2.5">
                <span className="text-muted-foreground">{r.fullName} — {r.email}</span>
                <form action={includeInSegment.bind(null, id, r.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Restoring…">Put back</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {staged ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ready to send</h2>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium">{staged.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">{staged.body}</pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Snapshotted for {staged._count.recipients} recipients when it was drafted, so what you confirm is
              what goes out even if the segment changes.
            </p>
            <div className="mt-3">
              <form action={deleteBroadcast.bind(null, staged.id)}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Discarding…">Discard draft</SubmitButton>
              </form>
            </div>
          </div>
          <CrmBroadcastSend broadcastId={staged.id} recipientCount={staged.recipientCount} subject={staged.subject} />
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Write an update</h2>
          <form action={stage} className="space-y-3 rounded-lg border border-border p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <input name="subject" required
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Message</span>
              <textarea name="body" rows={10} required
                placeholder={'Plain text — this should read like a note from you, not a newsletter.'}
                className="w-full rounded-md border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
            </label>
            <p className="text-xs text-muted-foreground">
              Drafting does not send. You will see the exact recipient count and have to type it to confirm.
            </p>
            <SubmitButton disabled={live.length === 0} pendingLabel="Saving…">Save draft</SubmitButton>
            {live.length === 0 && (
              <span className="ml-2 text-xs text-muted-foreground">Add someone to the segment first.</span>
            )}
          </form>
        </section>
      )}

      {broadcasts.filter((b) => b.sentAt).length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">History</h2>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {broadcasts.filter((b) => b.sentAt).map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span>{b.subject}{b.error && <span className="ml-2 text-xs text-destructive">{b.error}</span>}</span>
                <span className="text-xs text-muted-foreground">{b.recipientCount} sent · {formatDate(b.sentAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
