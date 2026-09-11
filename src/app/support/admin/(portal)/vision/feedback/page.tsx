import Link from 'next/link'
import type { Prisma, ProductFeedbackStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SubmitButton } from '@/components/ui/submit-button'
import { createFeedback, linkFeedback, markFeedbackAddressed, archiveFeedback } from '../actions'
import { SOURCES, SOURCE_LABELS, FEEDBACK_STATUS_LABELS, formatDate } from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const status = sp.status ?? ''

  const where: Prisma.ProductFeedbackWhereInput = {
    ...(status ? { status: status as ProductFeedbackStatus } : { status: { not: 'ARCHIVED' } }),
    ...(q ? { OR: [{ rawText: { contains: q, mode: 'insensitive' } }, { personLabel: { contains: q, mode: 'insensitive' } }] } : {}),
  }

  const [feedback, items, testers, counts] = await Promise.all([
    prisma.productFeedback.findMany({
      where, orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }], take: 200,
      include: {
        person: { select: { id: true, fullName: true } },
        links: { include: { item: { select: { id: true, title: true, status: true } } } },
      },
    }),
    prisma.productItem.findMany({
      where: { status: { not: 'SPARK' } }, select: { id: true, title: true },
      orderBy: { title: 'asc' }, take: 200,
    }),
    prisma.crmPerson.findMany({
      where: { roles: { hasSome: ['ADVISOR', 'JOB_SEEKER', 'COACH_PROSPECT'] } },
      select: { id: true, fullName: true }, orderBy: { fullName: 'asc' }, take: 300,
    }),
    prisma.productFeedback.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const countBy = new Map(counts.map((c) => [c.status, c._count._all]))
  const owed = feedback.filter((f) => f.status === 'TRIAGED' && f.links.some((l) => l.item.status === 'SHIPPED'))

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What people actually said, kept verbatim. Consolidation happens by linking several pieces to one
          item — never by rewriting them, because the words are the evidence.
        </p>
      </header>

      {owed.length > 0 && (
        <div className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
          <strong>{owed.length}</strong> {owed.length === 1 ? 'person' : 'people'} asked for something that has
          since shipped and {owed.length === 1 ? 'has' : 'have'} not been told. A tester who hears back gives you
          more feedback; one who never does stops.
        </div>
      )}

      <form action={createFeedback} className="space-y-3 rounded-lg border border-border p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">What they said</span>
          <textarea
            name="rawText" rows={3} required placeholder="Their words, not your summary of them."
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Who</span>
            <select name="personId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">Not in the Ecosystem</option>
              {testers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Or a name</span>
            <input name="personLabel" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">They are a</span>
            <select name="source" defaultValue="TESTER" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">When they said it</span>
            <input name="receivedAt" type="date" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          When they said it is stored separately from when you logged it — those differ, and the gap is worth
          seeing.
        </p>
        <SubmitButton pendingLabel="Saving…">Log feedback</SubmitButton>
      </form>

      <AdminFilterBar
        basePath="/support/admin/vision/feedback"
        searchValue={q}
        searchPlaceholder="Search what people said…"
        filters={[{
          key: 'status', label: 'Status', value: status,
          options: [
            { value: '', label: 'Everything but archived' },
            ...(['NEW', 'TRIAGED', 'ADDRESSED', 'ARCHIVED'] as const).map((s) => ({
              value: s, label: `${FEEDBACK_STATUS_LABELS[s]} (${countBy.get(s) ?? 0})`,
            })),
          ],
        }]}
      />

      {feedback.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {feedback.map((f) => {
            const link = linkFeedback.bind(null, f.id)
            const addressed = markFeedbackAddressed.bind(null, f.id)
            return (
              <li key={f.id} className="rounded-lg border border-border p-3">
                <p className="text-sm">“{f.rawText}”</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {f.person ? (
                    <Link href={`/support/admin/crm/people/${f.person.id}`} className="underline">{f.person.fullName}</Link>
                  ) : (f.personLabel ?? 'Unattributed')}
                  <span>{SOURCE_LABELS[f.source]}</span>
                  <span>said {formatDate(f.receivedAt)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{FEEDBACK_STATUS_LABELS[f.status]}</span>
                </p>

                {f.links.length > 0 && (
                  <p className="mt-1.5 text-xs">
                    <span className="text-muted-foreground">Linked to: </span>
                    {f.links.map((l, i) => (
                      <span key={l.id}>
                        {i > 0 && ', '}
                        <Link href={`/support/admin/vision/items/${l.item.id}`} className="underline">{l.item.title}</Link>
                        {l.item.status === 'SHIPPED' && <span className="text-brand"> (shipped)</span>}
                      </span>
                    ))}
                  </p>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {f.status === 'NEW' ? 'Link it to something' : 'Link, or close the loop'}
                  </summary>
                  <div className="mt-2 space-y-3">
                    <form action={link} className="flex flex-wrap items-end gap-2">
                      <label className="text-xs">
                        <span className="mb-1 block font-medium">Existing item</span>
                        <select name="itemId" defaultValue="" className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                          <option value="">Choose…</option>
                          {items.map((i) => <option key={i.id} value={i.id}>{i.title.slice(0, 70)}</option>)}
                        </select>
                      </label>
                      <label className="text-xs">
                        <span className="mb-1 block font-medium">Or create one</span>
                        <input name="newItemTitle" placeholder="New gap" className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" />
                      </label>
                      <SubmitButton size="sm" pendingLabel="Linking…">Link</SubmitButton>
                    </form>

                    {f.status !== 'ADDRESSED' && (
                      <form action={addressed} className="flex flex-wrap items-end gap-2">
                        <label className="text-xs">
                          <span className="mb-1 block font-medium">Told them what happened</span>
                          <input name="responseNote" placeholder="Emailed — shipped in the Sept release" className="h-8 w-64 rounded-md border border-input bg-transparent px-2 text-xs" />
                        </label>
                        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Mark as told</SubmitButton>
                      </form>
                    )}

                    <form action={archiveFeedback.bind(null, f.id)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Archiving…">Archive</SubmitButton>
                    </form>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
