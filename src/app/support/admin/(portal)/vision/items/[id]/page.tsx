import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateItem, deleteItem } from '../../actions'
import { extractSections } from '@/lib/vision/markdown'
import {
  KINDS, KIND_LABELS, STATUSES, STATUS_LABELS, BUCKETS, BUCKET_LABELS,
  EFFORTS, EFFORT_LABELS, SOURCE_LABELS, statusClass, formatDate,
} from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [item, others, doc] = await Promise.all([
    prisma.productItem.findUnique({
      where: { id },
      include: {
        feedbackLinks: { include: { feedback: { include: { person: { select: { id: true, fullName: true } } } } } },
        blockedBy: { select: { id: true, title: true } },
        blocking: { select: { id: true, title: true } },
        children: { select: { id: true, title: true, status: true } },
        competitorCells: { include: { competitor: { select: { name: true } } } },
      },
    }),
    prisma.productItem.findMany({
      where: { id: { not: id }, status: { not: 'SPARK' } },
      select: { id: true, title: true }, orderBy: { title: 'asc' }, take: 200,
    }),
    prisma.productVisionDoc.findFirst({ where: { isCurrent: true }, select: { bodyMarkdown: true } }),
  ])
  if (!item) notFound()

  const sections = doc ? extractSections(doc.bodyMarkdown) : []
  const save = updateItem.bind(null, item.id)

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision/items" className="text-muted-foreground hover:underline">← Roadmap</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{KIND_LABELS[item.kind]}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(item.status)}`}>{STATUS_LABELS[item.status]}</span>
          <span className="text-xs text-muted-foreground">{BUCKET_LABELS[item.bucket]}</span>
          {item.shippedAt && <span className="text-xs text-muted-foreground">Shipped {formatDate(item.shippedAt)}</span>}
        </p>
      </header>

      {item.feedbackLinks.length > 0 && (
        <section className="rounded-lg border border-brand/40 bg-brand/5 p-4">
          <h2 className="text-sm font-semibold">
            {item.feedbackLinks.length} {item.feedbackLinks.length === 1 ? 'person' : 'people'} raised this
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Their words, verbatim. This is the evidence the item exists — kept rather than summarized away.
          </p>
          <ul className="mt-2 space-y-2">
            {item.feedbackLinks.map((l) => (
              <li key={l.id} className="rounded-md border border-border bg-background p-2.5 text-sm">
                <p>“{l.feedback.rawText}”</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {l.feedback.person ? (
                    <Link href={`/support/admin/crm/people/${l.feedback.person.id}`} className="underline">
                      {l.feedback.person.fullName}
                    </Link>
                  ) : (l.feedback.personLabel ?? 'Unattributed')}
                  {' · '}{SOURCE_LABELS[l.feedback.source]}
                  {' · '}{formatDate(l.feedback.receivedAt)}
                  {l.feedback.respondedAt
                    ? ' · they have been told'
                    : item.status === 'SHIPPED' ? ' · NOT told yet' : ''}
                </p>
              </li>
            ))}
          </ul>
          {item.status === 'SHIPPED' && item.feedbackLinks.some((l) => !l.feedback.respondedAt) && (
            <p className="mt-2 text-xs font-medium text-orange">
              This shipped and some of the people who asked for it still do not know.{' '}
              <Link href="/support/admin/vision/feedback?status=TRIAGED" className="underline">Close the loop</Link>.
            </p>
          )}
        </section>
      )}

      <form action={save} className="space-y-3 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Title</span>
            <input name="title" defaultValue={item.title} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Detail</span>
            <textarea name="body" rows={5} defaultValue={item.body ?? ''} className="w-full rounded-md border border-input bg-transparent p-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Kind</span>
            <select name="kind" defaultValue={item.kind} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Status</span>
            <select name="status" defaultValue={item.status} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">When</span>
            <select name="bucket" defaultValue={item.bucket} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {BUCKETS.map((b) => <option key={b} value={b}>{BUCKET_LABELS[b]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Effort</span>
            <select name="effort" defaultValue={item.effort} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {EFFORTS.map((e) => <option key={e} value={e}>{EFFORT_LABELS[e]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Priority <span className="font-normal text-muted-foreground">1 highest</span></span>
            <input name="priority" type="number" min={1} max={5} defaultValue={item.priority ?? ''} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Blocked by</span>
            <select name="blockedById" defaultValue={item.blockedById ?? ''} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">Nothing</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.title.slice(0, 60)}</option>)}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Cost driver <span className="font-normal text-muted-foreground">what makes this expensive as usage grows</span></span>
            <input name="costDriver" defaultValue={item.costDriver ?? ''} placeholder="One model call per uploaded image" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Serves which part of the vision</span>
            <select name="visionSection" defaultValue={item.visionSection ?? ''} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">Not linked</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{'— '.repeat(s.level - 1)}{s.title}</option>)}
            </select>
            {sections.length === 0 && (
              <span className="mt-1 block text-xs text-muted-foreground">
                No vision document yet — <Link href="/support/admin/vision/doc" className="underline">add one</Link> and its headings appear here.
              </span>
            )}
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Why not, if not doing</span>
            <input name="wontDoReason" defaultValue={item.wontDoReason ?? ''} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
          </label>
        </div>
        <SubmitButton pendingLabel="Saving…">Save item</SubmitButton>
      </form>

      {(item.blocking.length > 0 || item.children.length > 0 || item.competitorCells.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {item.blocking.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold">Blocks</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {item.blocking.map((b) => (
                  <li key={b.id}><Link href={`/support/admin/vision/items/${b.id}`} className="hover:underline">{b.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
          {item.competitorCells.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold">Who else has this</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {item.competitorCells.filter((c) => c.overlap === 'HAS' || c.overlap === 'PARTIAL').map((c) => (
                  <li key={c.id} className="text-muted-foreground">{c.competitor.name} — {c.overlap.toLowerCase()}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <form action={deleteItem.bind(null, item.id)}>
        <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…">Delete item</SubmitButton>
      </form>
    </div>
  )
}
