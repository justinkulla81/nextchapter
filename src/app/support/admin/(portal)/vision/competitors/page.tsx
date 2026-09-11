import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { VisionMatrixCell } from '@/components/admin/VisionMatrixCell'
import { upsertCompetitor, deleteCompetitor } from '../actions'
import { formatDate } from '@/lib/vision/labels'

export const maxDuration = 30

function money(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`
  return `$${n.toLocaleString()}`
}

const STALE_DAYS = 90

/**
 * The cutoff for "not reviewed recently".
 *
 * Behind a helper because react-hooks/purity forbids reading the clock during
 * render — including in a server component's body, which is render. A freshness
 * check genuinely needs the current time, so the read is isolated here where
 * its impurity is the stated point.
 */
function staleCutoff(): Date {
  return new Date(Date.now() - STALE_DAYS * 86_400_000)
}

export default async function VisionCompetitorsPage() {
  await requireAdmin()

  const [competitors, features] = await Promise.all([
    prisma.productCompetitor.findMany({ orderBy: { name: 'asc' }, include: { cells: true } }),
    // The matrix columns are the SAME items we plan against — one vocabulary,
    // which is what makes gaps and moats a query rather than a re-judgement.
    prisma.productItem.findMany({
      where: { kind: 'FEATURE', status: { not: 'SPARK' } },
      select: { id: true, title: true }, orderBy: { title: 'asc' }, take: 40,
    }),
  ])

  const cellOf = (competitorId: string, itemId: string) =>
    competitors.find((c) => c.id === competitorId)?.cells.find((x) => x.itemId === itemId)?.overlap ?? 'UNKNOWN'

  // Gaps: features most competitors have and we have not shipped.
  const gaps = features
    .map((f) => ({
      ...f,
      have: competitors.filter((c) => c.cells.find((x) => x.itemId === f.id)?.overlap === 'HAS').length,
    }))
    .filter((f) => f.have >= Math.max(1, Math.ceil(competitors.length / 2)))
    .sort((a, b) => b.have - a.have)

  const moats = features
    .map((f) => ({
      ...f,
      none: competitors.filter((c) => c.cells.find((x) => x.itemId === f.id)?.overlap === 'NONE').length,
    }))
    .filter((f) => competitors.length > 0 && f.none === competitors.length)

  const staleBefore = staleCutoff()
  const staleCount = competitors.filter(
    (c) => !c.lastReviewedAt || c.lastReviewedAt < staleBefore
  ).length

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Competitors</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Them down the side, our own features across the top. Because the columns are the same items we plan
          against, gaps and moats fall out as a query rather than a judgement re-made each quarter.
        </p>
      </header>

      {competitors.length > 0 && staleCount > 0 && (
        <p className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
          <strong>{staleCount}</strong> of {competitors.length} have not been reviewed in {STALE_DAYS} days.
          A matrix is only useful while it is current, and an undated number in a deck is worse than no number.
        </p>
      )}

      {competitors.length > 0 && features.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <h2 className="text-sm font-semibold">Gaps — most of them have it, we don&apos;t</h2>
            {gaps.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None, on what has been filled in so far.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {gaps.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <Link href={`/support/admin/vision/items/${g.id}`} className="hover:underline">{g.title}</Link>
                    <span className="ml-2 text-xs text-muted-foreground">{g.have} of {competitors.length}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <h2 className="text-sm font-semibold">Moats — nobody else has it</h2>
            {moats.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None confirmed yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {moats.slice(0, 6).map((m) => (
                  <li key={m.id}><Link href={`/support/admin/vision/items/${m.id}`} className="hover:underline">{m.title}</Link></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">The matrix</h2>
        {competitors.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No competitors yet. Start with the few you actually lose to — a sparse matrix you trust beats a
            complete one you don&apos;t.
          </p>
        ) : features.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No features to compare yet. Add items of kind <strong>Feature</strong> on the{' '}
            <Link href="/support/admin/vision/items" className="underline">roadmap</Link> and they become the
            columns here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">Competitor</th>
                  {features.map((f) => (
                    <th key={f.id} className="px-2 py-2 text-left font-medium" style={{ minWidth: 120 }}>
                      <Link href={`/support/admin/vision/items/${f.id}`} className="hover:underline">{f.title}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {money(c.fundingRaisedUsd)} raised
                        {c.headcount ? ` · ${c.headcount} staff` : ''}
                        {c.lastReviewedAt ? ` · checked ${formatDate(c.lastReviewedAt)}` : ' · never checked'}
                      </span>
                    </td>
                    {features.map((f) => (
                      <td key={f.id} className="px-1.5 py-1.5">
                        <VisionMatrixCell
                          competitorId={c.id} itemId={f.id}
                          overlap={cellOf(c.id, f.id)}
                          competitorName={c.name} featureName={f.title}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Add or update a competitor</h2>
        <form action={upsertCompetitor} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block font-medium">Name</span>
            <input name="name" required className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Website</span>
            <input name="url" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Segment</span>
            <input name="segment" placeholder="Outplacement" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm sm:col-span-3"><span className="mb-1 block font-medium">Positioning</span>
            <input name="positioning" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Funding raised (USD)</span>
            <input name="fundingRaisedUsd" inputMode="numeric" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Headcount</span>
            <input name="headcount" inputMode="numeric" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Revenue (note)</span>
            <input name="revenueNote" placeholder="~$20M ARR (reported)" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Users (note)</span>
            <input name="userCountNote" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Where those numbers came from</span>
            <input name="sourceUrl" placeholder="https://…" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" /></label>
          <div className="sm:col-span-3">
            <SubmitButton pendingLabel="Saving…">Save competitor</SubmitButton>
            <span className="ml-2 text-xs text-muted-foreground">Saving re-dates the review, since these go stale silently.</span>
          </div>
        </form>
      </section>

      {competitors.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Detail</h2>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {competitors.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="font-medium">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.name}</a> : c.name}</span>
                  {c.positioning && <span className="mt-0.5 block text-xs text-muted-foreground">{c.positioning}</span>}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[c.segment, c.revenueNote, c.userCountNote].filter(Boolean).join(' · ') || 'No firmographics recorded'}
                    {c.sourceUrl && <> · <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a></>}
                  </span>
                </span>
                <form action={deleteCompetitor.bind(null, c.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
