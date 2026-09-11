import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/vision/markdown'
import { KIND_LABELS, BUCKET_LABELS, formatDate } from '@/lib/vision/labels'

export const maxDuration = 30

export default async function VisionHomePage() {
  await requireAdmin()

  const [doc, sparks, byBucket, feedbackNew, unaddressed, competitors, blockers] = await Promise.all([
    prisma.productVisionDoc.findFirst({ where: { isCurrent: true } }),
    prisma.productItem.count({ where: { status: 'SPARK' } }),
    prisma.productItem.groupBy({
      by: ['bucket'], _count: { _all: true },
      where: { status: { notIn: ['SPARK', 'SHIPPED', 'WONT_DO'] } },
    }),
    prisma.productFeedback.count({ where: { status: 'NEW' } }),
    prisma.productFeedback.count({ where: { status: 'TRIAGED' } }),
    prisma.productCompetitor.count(),
    prisma.productItem.findMany({
      where: { kind: 'BLOCKER', status: { notIn: ['SHIPPED', 'WONT_DO'] } },
      include: { _count: { select: { blocking: true } } },
      orderBy: { createdAt: 'desc' }, take: 5,
    }),
  ])
  const bucketCount = new Map(byBucket.map((b) => [b.bucket, b._count._all]))

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

      <p className="text-xs text-muted-foreground">
        Item kinds: {Object.values(KIND_LABELS).join(' · ')} — one table, because these convert into one
        another constantly.
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
