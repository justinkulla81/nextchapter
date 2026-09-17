import Link from 'next/link'
import type { Prisma, ProductItemKind, ProductItemArea, ProductItemStatus, ProductRoadmapBucket } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SubmitButton } from '@/components/ui/submit-button'
import { KindSelect, AreaSelect } from '@/components/admin/VisionKindSelect'
import { VisionInlineSelect, VisionInlineKindSelect, VisionInlineTitle } from '@/components/admin/VisionInlineEdit'
import { createItem, promoteSpark, deleteItem } from '../actions'
import {
  KINDS, KIND_LABELS, KIND_GROUPS, AREAS, AREA_LABELS, AREA_HINTS, areaClass,
  STATUSES, STATUS_LABELS, BUCKETS, BUCKET_LABELS, EFFORT_LABELS, statusClass,
} from '@/lib/vision/labels'

export const maxDuration = 30

const PRIORITY_OPTIONS = [
  { value: '', label: 'Unranked' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `P${n}` })),
]

export default async function VisionItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const kind = sp.kind ?? ''
  const area = sp.area ?? ''
  const status = sp.status ?? ''
  const bucket = sp.bucket ?? ''
  // Two ways to read the same list: what it is about, or when it happens.
  const groupBy = sp.group === 'when' ? 'when' : 'area'

  const where: Prisma.ProductItemWhereInput = {
    // Sparks stay out of the judged list — an unjudged idea sitting in a
    // prioritised backlog is noise. They get their own strip below instead,
    // so brainstorming happens next to the roadmap rather than elsewhere.
    status: status ? (status as ProductItemStatus) : { not: 'SPARK' },
    ...(kind ? { kind: kind as ProductItemKind } : {}),
    ...(area ? { area: area as ProductItemArea } : {}),
    ...(bucket ? { bucket: bucket as ProductRoadmapBucket } : {}),
    ...(q
      ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }
      : {}),
  }

  const [items, sparks] = await Promise.all([
    prisma.productItem.findMany({
      where,
      orderBy: [{ bucket: 'asc' }, { priority: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { feedbackLinks: true, blocking: true } },
        blockedBy: { select: { id: true, title: true, status: true } },
      },
      take: 300,
    }),
    prisma.productItem.findMany({
      where: { status: 'SPARK', ...(area ? { area: area as ProductItemArea } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, kind: true, area: true },
      take: 30,
    }),
  ])

  const grouped = groupBy === 'area'
    ? AREAS.map((a) => ({ key: a as string, label: AREA_LABELS[a], rows: items.filter((i) => i.area === a) }))
    : BUCKETS.map((b) => ({ key: b as string, label: BUCKET_LABELS[b], rows: items.filter((i) => i.bucket === b) }))

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(kind ? { kind } : {}), ...(area ? { area } : {}), ...(status ? { status } : {}), ...(bucket ? { bucket } : {}), ...over })
    return `/support/admin/vision/items?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roadmap</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Goals, features, bugs, feedback, copy, content, questions, principles, to-dos and blockers
            across Company, Product, GTM, Operations, Finance and Legal — one list, because they convert
            into one another constantly.
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
          { key: 'area', label: 'Area', value: area, options: [{ value: '', label: 'Any area' }, ...AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))] },
          { key: 'kind', label: 'Kind', value: kind, options: [{ value: '', label: 'Any kind' }, ...KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))] },
          { key: 'status', label: 'Status', value: status, options: [{ value: '', label: 'Everything but sparks' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))] },
          { key: 'bucket', label: 'When', value: bucket, options: [{ value: '', label: 'Any time' }, ...BUCKETS.map((b) => ({ value: b, label: BUCKET_LABELS[b] }))] },
        ]}
      />

      {/* Capture. Two buttons, one form: a judged item, or a spark that skips
          the grading — which is the only way a brainstorm survives sitting
          next to a prioritised backlog. */}
      <form action={createItem} className="rounded-lg border border-border p-4">
        <label htmlFor="item-title" className="mb-1 block text-sm font-medium">Add an item</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="item-title" name="title" required placeholder="What is it"
            className="h-9 min-w-64 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <AreaSelect value={(area || 'PRODUCT') as ProductItemArea} />
          <KindSelect value={(kind || 'FEATURE') as ProductItemKind} />
          <SubmitButton name="status" value="NEW" pendingLabel="Adding…">Add item</SubmitButton>
          <SubmitButton name="status" value="SPARK" variant="outline" pendingLabel="Capturing…">
            Capture as spark
          </SubmitButton>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {AREA_HINTS[(area || 'PRODUCT') as ProductItemArea]} — change the area or kind to see the rest.
          A spark carries no grade, owner or estimate until you promote it.
        </p>
      </form>

      {sparks.length > 0 && (
        <section className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <h2 className="text-sm font-semibold">
            Sparks <span className="font-normal text-muted-foreground">{sparks.length} unjudged</span>
          </h2>
          <ul className="mt-2 space-y-1.5">
            {sparks.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/support/admin/vision/items/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
                <span className={`rounded-full px-2 py-0.5 text-xs ${areaClass(s.area)}`}>{AREA_LABELS[s.area]}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{KIND_LABELS[s.kind]}</span>
                <form action={promoteSpark.bind(null, s.id)} className="inline">
                  <SubmitButton size="sm" variant="outline" pendingLabel="Promoting…">Promote</SubmitButton>
                </form>
                <form action={deleteItem.bind(null, s.id)} className="inline">
                  <SubmitButton size="sm" variant="outline" pendingLabel="Deleting…">Delete</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group by</span>
        {([['area', 'Area'], ['when', 'When']] as const).map(([value, label]) => (
          <Link
            key={value}
            href={qs({ group: value })}
            className={`rounded-md border px-3 py-1 ${groupBy === value ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-border hover:bg-muted'}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing matches these filters.</p>
          <Link href="/support/admin/vision/items" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        grouped.filter((g) => g.rows.length > 0).map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 text-lg font-semibold">
              {g.label} <span className="text-sm font-normal text-muted-foreground">{g.rows.length}</span>
            </h2>
            <ul className="space-y-2">
              {g.rows.map((i) => (
                <li key={i.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <VisionInlineTitle itemId={i.id} value={i.title} />
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <VisionInlineSelect
                          itemId={i.id} field="area" value={i.area} label="Area"
                          options={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
                          className={areaClass(i.area)}
                        />
                        <VisionInlineKindSelect itemId={i.id} value={i.kind} groups={KIND_GROUPS} labels={KIND_LABELS} />
                        <VisionInlineSelect
                          itemId={i.id} field="status" value={i.status} label="Status"
                          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                          className={statusClass(i.status)}
                        />
                        <VisionInlineSelect
                          itemId={i.id} field="bucket" value={i.bucket} label="When"
                          options={BUCKETS.map((b) => ({ value: b, label: BUCKET_LABELS[b] }))}
                        />
                        <VisionInlineSelect
                          itemId={i.id} field="priority" value={i.priority ? String(i.priority) : ''} label="Priority"
                          options={PRIORITY_OPTIONS}
                        />
                        <Link href={`/support/admin/vision/items/${i.id}`} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                          Open
                        </Link>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
