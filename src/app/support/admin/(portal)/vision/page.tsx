import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/vision/markdown'
import { VisionInlineSelect } from '@/components/admin/VisionInlineEdit'
import {
  KIND_GROUPS, KIND_LABELS, AREAS, AREA_LABELS, areaClass,
  BUCKET_LABELS, STATUS_LABELS, formatDate,
} from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionHomePage() {
  await requireAdmin()

  const OPEN: Prisma.ProductItemWhereInput = { status: { notIn: ['SPARK', 'SHIPPED', 'WONT_DO'] } }

  const [doc, sparks, byBucket, byArea, feedbackNew, unaddressed, competitors, blockers, todos] =
    await Promise.all([
      prisma.productVisionDoc.findFirst({ where: { isCurrent: true } }),
      prisma.productItem.count({ where: { status: 'SPARK' } }),
      prisma.productItem.groupBy({ by: ['bucket'], _count: { _all: true }, where: OPEN }),
      prisma.productItem.groupBy({ by: ['area'], _count: { _all: true }, where: OPEN }),
      prisma.productFeedback.count({ where: { status: 'NEW' } }),
      prisma.productFeedback.count({ where: { status: 'TRIAGED' } }),
      prisma.productCompetitor.count(),
      prisma.productItem.findMany({
        where: { kind: 'BLOCKER', status: { notIn: ['SHIPPED', 'WONT_DO'] } },
        include: { _count: { select: { blocking: true } } },
        orderBy: { createdAt: 'desc' }, take: 5,
      }),
      // The to-dos live on the roadmap like everything else; this is the same
      // rows, surfaced where you actually look each morning. Shipped and
      // not-doing drop out, so the list empties as you work it.
      prisma.productItem.findMany({
        where: { kind: 'TODO', ...OPEN },
        orderBy: [{ priority: { sort: 'asc', nulls: 'last' } }, { bucket: 'asc' }, { updatedAt: 'desc' }],
        select: { id: true, title: true, area: true, status: true, bucket: true, priority: true },
        take: 25,
      }),
    ])
  const bucketCount = new Map(byBucket.map((b) => [b.bucket, b._count._all]))
  const areaCount = new Map(byArea.map((a) => [a.area, a._count._all]))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">NextChapter Vision</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            What we&apos;re building and why — the master vision, what testers told us, the roadmap it
            feeds, and who else is in the market.
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Link href="/support/admin/vision/export" prefetch={false} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Export for Claude
          </Link>
          <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Ecosystem
          </Link>
        </span>
      </header>

      <nav className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile href="/support/admin/vision/doc" label="Master vision" value={doc ? `v${doc.version}` : 'Not set'} hint={doc ? `Updated ${formatDate(doc.createdAt)}` : 'Import or write it'} />
        <Tile href="/support/admin/vision/brainstorm" label="Sparks" value={String(sparks)} hint="Unjudged, on purpose" />
        <Tile href="/support/admin/vision/items" label="On the roadmap" value={String((bucketCount.get('NOW') ?? 0) + (bucketCount.get('NEXT') ?? 0))} hint={`${bucketCount.get('NOW') ?? 0} now · ${bucketCount.get('NEXT') ?? 0} next`} />
        <Tile href="/support/admin/vision/feedback" label="Feedback" value={String(feedbackNew)} hint={unaddressed > 0 ? `${unaddressed} linked, nobody told yet` : 'Nothing untriaged'} />
        <Tile href="/support/admin/vision/competitors" label="Competitors" value={String(competitors)} hint="Matrix against our features" />
      </nav>

      {blockers.length > 0 && (
        <section className="rounded-lg border border-orange/40 bg-orange/5 p-4">
          <h2 className="text-sm font-semibold">Blocking other work</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {blockers.map((b) => (
              <li key={b.id}>
                <Link href={`/support/admin/vision/items/${b.id}`} className="font-medium hover:underline">{b.title}</Link>
                {b._count.blocking > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    blocks {b._count.blocking} {b._count.blocking === 1 ? 'item' : 'items'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            To-do <span className="text-sm font-normal text-muted-foreground">{todos.length} open</span>
          </h2>
          <Link href="/support/admin/vision/items?kind=TODO" className="text-sm text-brand underline">
            On the roadmap
          </Link>
        </div>
        {todos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No open to-dos. Add one on the roadmap with the kind set to To-do.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {todos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 p-2.5">
                <Link href={`/support/admin/vision/items/${t.id}`} className="min-w-0 flex-1 text-sm font-medium hover:underline">
                  {t.title}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-xs ${areaClass(t.area)}`}>{AREA_LABELS[t.area]}</span>
                {t.priority && <span className="text-xs text-muted-foreground">P{t.priority}</span>}
                <span className="text-xs text-muted-foreground">{BUCKET_LABELS[t.bucket]}</span>
                {/* Tick it off without leaving the page — the whole reason the
                    list is here rather than one click away. */}
                <VisionInlineSelect
                  itemId={t.id} field="status" value={t.status} label="Status"
                  options={(['NEW', 'TRIAGED', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'WONT_DO'] as const).map((st) => ({
                    value: st, label: st === 'SHIPPED' ? 'Done' : STATUS_LABELS[st],
                  }))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{doc?.title ?? 'Master product vision'}</h2>
          <Link href="/support/admin/vision/doc" className="text-sm text-brand underline">
            {doc ? 'Edit or download' : 'Write it'}
          </Link>
        </div>
        {doc ? (
          <article
            className="rounded-lg border border-border p-5 text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.bodyMarkdown) }}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="font-medium">No vision document yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste your existing master document and it becomes version 1. Versioning is only useful once
              there is a baseline to diff against, so importing on day one is worth the five minutes.
            </p>
            <Link href="/support/admin/vision/doc" className="mt-3 inline-block text-sm font-medium text-brand underline">
              Add the vision document
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {(['NOW', 'NEXT', 'LATER', 'UNSCHEDULED'] as const).map((b) => (
          <div key={b} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{BUCKET_LABELS[b]}</p>
            <p className="mt-0.5 text-lg font-semibold">{bucketCount.get(b) ?? 0}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">By area</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {AREAS.map((a) => (
            <Link key={a} href={`/support/admin/vision/items?area=${a}`} className="rounded-lg border border-border p-3 hover:border-brand">
              <p className="text-xs text-muted-foreground">{AREA_LABELS[a]}</p>
              <p className="mt-0.5 text-lg font-semibold">{areaCount.get(a) ?? 0}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Item kinds — {KIND_GROUPS.map((g) => `${g.label}: ${g.kinds.map((k) => KIND_LABELS[k]).join(', ')}`).join(' · ')}
        . One table, because these convert into one another constantly.
      </p>
    </div>
  )
}

function Tile({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border p-3 hover:border-brand">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}
