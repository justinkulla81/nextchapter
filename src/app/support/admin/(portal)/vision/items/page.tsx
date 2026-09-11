import Link from 'next/link'
import type { Prisma, ProductItemKind, ProductItemStatus, ProductRoadmapBucket } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SubmitButton } from '@/components/ui/submit-button'
import { createItem } from '../actions'
import {
  KINDS, KIND_LABELS, KIND_HINTS, STATUSES, STATUS_LABELS, BUCKETS, BUCKET_LABELS,
  EFFORT_LABELS, statusClass,
} from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const kind = sp.kind ?? ''
  const status = sp.status ?? ''
  const bucket = sp.bucket ?? ''

  const where: Prisma.ProductItemWhereInput = {
    // Sparks live in the brainstorm; mixing them in is what makes a backlog
    // stop being trusted.
    status: status ? (status as ProductItemStatus) : { not: 'SPARK' },
    ...(kind ? { kind: kind as ProductItemKind } : {}),
    ...(bucket ? { bucket: bucket as ProductRoadmapBucket } : {}),
    ...(q
      ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }
      : {}),
  }

  const items = await prisma.productItem.findMany({
    where,
    orderBy: [{ bucket: 'asc' }, { priority: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { feedbackLinks: true, blocking: true } },
      blockedBy: { select: { id: true, title: true, status: true } },
    },
    take: 300,
  })

  const grouped = BUCKETS.map((b) => ({ bucket: b, rows: items.filter((i) => i.bucket === b) }))

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roadmap</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Goals, features, gaps, questions, principles, to-dos and blockers — one list, because they
            convert into one another constantly.
          </p>
        </div>
        <Link href="/support/admin/vision/brainstorm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          Brainstorm
        </Link>
      </header>

      <AdminFilterBar
        basePath="/support/admin/vision/items"
        searchValue={q}
        searchPlaceholder="Search title or body…"
        filters={[
          { key: 'kind', label: 'Kind', value: kind, options: [{ value: '', label: 'Any kind' }, ...KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))] },
          { key: 'status', label: 'Status', value: status, options: [{ value: '', label: 'Everything but sparks' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))] },
          { key: 'bucket', label: 'When', value: bucket, options: [{ value: '', label: 'Any time' }, ...BUCKETS.map((b) => ({ value: b, label: BUCKET_LABELS[b] }))] },
        ]}
      />

      <form action={createItem} className="rounded-lg border border-border p-4">
        <input type="hidden" name="status" value="NEW" />
        <label htmlFor="item-title" className="mb-1 block text-sm font-medium">Add an item</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="item-title" name="title" required placeholder="What is it"
            className="h-9 min-w-64 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <select name="kind" defaultValue="FEATURE" aria-label="Kind" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
          <SubmitButton pendingLabel="Adding…">Add item</SubmitButton>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{KIND_HINTS.FEATURE} — change the kind to see the rest.</p>
      </form>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing matches these filters.</p>
          <Link href="/support/admin/vision/items" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        grouped.filter((g) => g.rows.length > 0).map((g) => (
          <section key={g.bucket}>
            <h2 className="mb-2 text-lg font-semibold">
              {BUCKET_LABELS[g.bucket]} <span className="text-sm font-normal text-muted-foreground">{g.rows.length}</span>
            </h2>
            <ul className="space-y-2">
              {g.rows.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/support/admin/vision/items/${i.id}`} className="text-sm font-medium hover:underline">
                        {i.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5">{KIND_LABELS[i.kind]}</span>
                        <span className={`rounded-full px-2 py-0.5 ${statusClass(i.status)}`}>{STATUS_LABELS[i.status]}</span>
                        {i.priority && <span>P{i.priority}</span>}
                        {i.effort !== 'UNKNOWN' && <span>{EFFORT_LABELS[i.effort]}</span>}
                        {i._count.feedbackLinks > 0 && (
                          <span className="font-medium text-foreground">
                            {i._count.feedbackLinks} {i._count.feedbackLinks === 1 ? 'person asked' : 'people asked'}
                          </span>
                        )}
                        {i._count.blocking > 0 && <span className="text-orange">blocks {i._count.blocking}</span>}
                      </p>
                      {i.blockedBy && i.blockedBy.status !== 'SHIPPED' && (
                        <p className="mt-1 text-xs text-orange">Blocked by “{i.blockedBy.title}”</p>
                      )}
                      {i.costDriver && (
                        <p className="mt-1 text-xs text-muted-foreground">Cost driver: {i.costDriver}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
