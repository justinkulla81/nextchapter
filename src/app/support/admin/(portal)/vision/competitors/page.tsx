import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { VisionMatrixCell } from '@/components/admin/VisionMatrixCell'
import { CompetitorForm } from '@/components/admin/CompetitorForm'
import { quickAddCompetitor, refreshCompetitorFromWebsite, deleteCompetitor } from '../actions'
import { formatDate } from '@/lib/vision/labels'
import { COMPETITOR_AREAS, RELATIONSHIPS, CATEGORIES, areaLabel, relationshipLabel, statusLabel, categoryLabel, type NamedEntry, type WinEntry } from '@/lib/vision/competitor-areas'

export const maxDuration = 60

function money(n: number | null): string | null {
  if (!n) return null
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

const REL_STYLE: Record<string, string> = {
  DIRECT: 'bg-red-500/10 text-red-700 dark:text-red-300',
  ADJACENT: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PARTNER: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SUPPLIER: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (items.length === 0) return null
  return (
    <div className="min-w-0">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${tone ?? 'text-muted-foreground'}`}>{title}</h4>
      <ul className="mt-1 space-y-0.5 text-sm">{items.map((x, i) => <li key={i} className="flex gap-1.5"><span aria-hidden className="text-muted-foreground">•</span><span>{x}</span></li>)}</ul>
    </div>
  )
}

export default async function VisionCompetitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const areaFilter = sp.area ?? ''
  const relFilter = sp.rel ?? ''
  const catFilter = sp.cat ?? ''
  const gone = sp.gone === '1'

  const [allCompetitors, features] = await Promise.all([
    prisma.productCompetitor.findMany({ orderBy: { name: 'asc' }, include: { cells: true } }),
    // The matrix columns are the SAME items we plan against — one vocabulary,
    // which is what makes gaps and moats a query rather than a re-judgement.
    prisma.productItem.findMany({
      where: { kind: 'FEATURE', status: { not: 'SPARK' } },
      select: { id: true, title: true }, orderBy: { title: 'asc' }, take: 40,
    }),
  ])
  const competitors = allCompetitors
  const shown = allCompetitors.filter((c) => (!areaFilter || c.areas.includes(areaFilter)) && (!relFilter || c.relationship === relFilter) && (!catFilter || c.category === catFilter) && (!gone || c.status !== 'ACTIVE'))
  const relOrder = (r: string) => RELATIONSHIPS.findIndex((x) => x.key === r)
  shown.sort((a, b) => relOrder(a.relationship) - relOrder(b.relationship) || a.name.localeCompare(b.name))

  const areaCount = new Map<string, number>()
  for (const c of allCompetitors) if (c.relationship === 'DIRECT' || c.relationship === 'ADJACENT') for (const a of c.areas) areaCount.set(a, (areaCount.get(a) ?? 0) + 1)
  const needCount = new Map<string, { n: number; who: string[] }>()
  for (const c of allCompetitors) for (const need of c.weNeed) {
    const k = need.toLowerCase().slice(0, 60)
    const cur = needCount.get(k) ?? { n: 0, who: [] }
    needCount.set(k, { n: cur.n + 1, who: [...cur.who, c.name] })
  }
  const needs = [...needCount.entries()].map(([k, v]) => ({ text: allCompetitors.flatMap((c) => c.weNeed).find((x) => x.toLowerCase().slice(0, 60) === k) ?? k, ...v })).sort((a, b) => b.n - a.n).slice(0, 8)

  const cellOf = (competitorId: string, itemId: string) =>
    competitors.find((c) => c.id === competitorId)?.cells.find((x) => x.itemId === itemId)?.overlap ?? 'UNKNOWN'
  const gaps = features
    .map((f) => ({ ...f, have: competitors.filter((c) => c.cells.find((x) => x.itemId === f.id)?.overlap === 'HAS').length }))
    .filter((f) => f.have >= Math.max(1, Math.ceil(competitors.length / 2)))
    .sort((a, b) => b.have - a.have)
  const moats = features
    .map((f) => ({ ...f, none: competitors.filter((c) => c.cells.find((x) => x.itemId === f.id)?.overlap === 'NONE').length }))
    .filter((f) => competitors.length > 0 && f.none === competitors.length)

  const staleBefore = staleCutoff()
  const staleCount = competitors.filter((c) => !c.lastReviewedAt || c.lastReviewedAt < staleBefore).length
  const reviewCount = competitors.filter((c) => c.needsReview).length
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ area: areaFilter, rel: relFilter, cat: catFilter, gone: gone ? '1' : '', ...over })) if (v) p.set(k, v)
    const t = p.toString()
    return `/support/admin/vision/competitors${t ? `?${t}` : ''}`
  }

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/vision" className="text-muted-foreground hover:underline">← Vision</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Competitors</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Who we compete with, where, what they have won, who they sell to, and what we would need to beat them.
          {competitors.length > 0 && <> {competitors.length} tracked.</>}
        </p>
        <p className="mt-2 text-sm"><Link href="/support/admin/vision/capabilities" className="underline">Compare capabilities, area by area, with sources</Link></p>
      </header>

      {sp.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">{sp.error}</p>}
      {sp.added && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          {sp.existing ? 'Already tracked. ' : sp.refreshed ? 'Refreshed from the website. ' : 'Added from the website. '}
          <a href={`#c-${sp.added}`} className="underline">Jump to the card</a> and check it: a draft read from a website can be wrong, and the numbers are only filled when they are public.
        </p>
      )}

      <section className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
        <h2 className="text-lg font-semibold">Add a competitor from its website</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Paste the address. We read the site and a little public reporting, then fill in what they do, who they sell to, features, customers, what they have won, and funding, revenue and employees when those are public. You only check it. About 5 to 15 cents a read.
        </p>
        <form action={quickAddCompetitor} className="mt-3 flex flex-wrap gap-2">
          <input name="url" required placeholder="futurefit.ai" aria-label="Competitor website" className="h-11 min-w-[16rem] flex-1 rounded-md border border-input bg-background px-3 text-base" />
          <SubmitButton pendingLabel="Reading the site… (up to a minute)" className="h-11 px-5 text-base">Add from website</SubmitButton>
        </form>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm underline">Add by hand instead</summary>
          <div className="mt-3 rounded-lg border border-border bg-background p-4"><CompetitorForm submitLabel="Save competitor" /></div>
        </details>
      </section>

      {competitors.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <h2 className="text-sm font-semibold">Where they crowd us</h2>
            <p className="text-xs text-muted-foreground">Direct and adjacent competitors per area. Select one to filter.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMPETITOR_AREAS.map((a) => {
                const n = areaCount.get(a.key) ?? 0
                const on = areaFilter === a.key
                return (
                  <Link key={a.key} href={qs({ area: on ? '' : a.key })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>
                    {a.label} <span className="text-muted-foreground">{n}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h2 className="text-sm font-semibold">What we would need to build, most-cited first</h2>
            {needs.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Nothing recorded yet.</p> : (
              <ul className="mt-1 space-y-1 text-sm">
                {needs.map((n) => <li key={n.text}>{n.text} <span className="ml-1 text-xs text-muted-foreground">{n.n} competitor{n.n === 1 ? '' : 's'}</span></li>)}
              </ul>
            )}
          </div>
        </section>
      )}

      {competitors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show:</span>
          <Link href={qs({ rel: '' })} className={`rounded-md border px-2.5 py-1 ${!relFilter ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>All {competitors.length}</Link>
          {RELATIONSHIPS.map((r) => (
            <Link key={r.key} href={qs({ rel: relFilter === r.key ? '' : r.key })} title={r.hint} className={`rounded-md border px-2.5 py-1 ${relFilter === r.key ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>
              {r.label} {competitors.filter((c) => c.relationship === r.key).length}
            </Link>
          ))}
          <Link href={qs({ gone: gone ? '' : '1' })} className={`rounded-md border px-2.5 py-1 ${gone ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`} title="Acquired, shut down or left the market: what went wrong is the cheapest lesson">Failed or gone {competitors.filter((c) => c.status !== 'ACTIVE').length}</Link>
          {areaFilter && <Link href={qs({ area: '' })} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">Area: {areaLabel(areaFilter)} ✕</Link>}
          {reviewCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{reviewCount} drafts to check</span>}
        </div>
      )}

      {competitors.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-sm text-muted-foreground">Market:</span>
          {CATEGORIES.map((c) => {
            const n = competitors.filter((x) => x.category === c.key).length
            if (n === 0) return null
            const on = catFilter === c.key
            return <Link key={c.key} href={qs({ cat: on ? '' : c.key })} className={`rounded-full border px-2.5 py-1 ${on ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`}>{c.label} <span className="text-muted-foreground">{n}</span></Link>
          })}
          {catFilter && <Link href={qs({ cat: '' })} className="rounded-full border border-border px-2.5 py-1 hover:bg-muted">Clear ✕</Link>}
        </div>
      )}

      {competitors.length > 0 && staleCount > 0 && (
        <p className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
          <strong>{staleCount}</strong> of {competitors.length} have not been reviewed in {STALE_DAYS} days.
          A card is only useful while it is current, and an undated number in a deck is worse than no number.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {competitors.length === 0 ? 'No competitors yet. Paste a website above to add the first.' : 'No competitors match this filter.'}
        </p>
      ) : (
        <section className="space-y-2">
          {shown.map((c) => {
            const customers = (c.customers as NamedEntry[] | null) ?? []
            const wins = (c.wins as WinEntry[] | null) ?? []
            const numbers = [
              money(c.fundingRaisedUsd) && { k: 'Raised', v: money(c.fundingRaisedUsd)! },
              c.lastRound && { k: 'Last round', v: c.lastRound },
              c.revenueNote && { k: 'Revenue', v: c.revenueNote },
              c.headcount && { k: 'Employees', v: c.headcount.toLocaleString() },
              c.userCountNote && { k: 'Users', v: c.userCountNote },
              c.investors && { k: 'Investors', v: c.investors },
              c.foundedYear && { k: 'Founded', v: String(c.foundedYear) },
              c.hq && { k: 'HQ', v: c.hq },
              c.pricingNote && { k: 'Pricing', v: c.pricingNote },
            ].filter(Boolean) as { k: string; v: string }[]
            return (
              <details key={c.id} id={`c-${c.id}`} open={sp.added === c.id} className={`group rounded-xl border p-3 ${sp.added === c.id ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-border'}`}>
                <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.name} ↗</a> : c.name}</h3>
                    <p className="text-xs text-muted-foreground">{[categoryLabel(c.category), c.segment, c.lastReviewedAt ? `checked ${formatDate(c.lastReviewedAt)}` : 'never checked'].filter(Boolean).join(' · ')}</p>
                    {c.positioning && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground group-open:hidden">{c.positioning}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${REL_STYLE[c.relationship] ?? ''}`}>{relationshipLabel(c.relationship)}</span>
                    {c.status !== 'ACTIVE' && <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-700 dark:text-red-300">{statusLabel(c.status)}</span>}
                    {c.needsReview && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300" title="Filled from a website or a memo. Open Edit, check it, save.">Check this</span>}
                  </div>
                </summary>
                <div className="mt-3">
                {c.status !== 'ACTIVE' && (
                  <p className="mb-2 rounded-md bg-red-500/5 p-2 text-sm"><strong>{statusLabel(c.status)}.</strong> {c.statusNote ?? ''}</p>
                )}
                {c.positioning && <p className="mt-2 text-sm">{c.positioning}</p>}
                {c.partnerIdea && <p className="mt-2 rounded-md bg-emerald-500/5 p-2 text-sm"><strong>How we could work together.</strong> {c.partnerIdea}</p>}
                {c.areas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.areas.map((a) => <Link key={a} href={qs({ area: a })} className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted">{areaLabel(a)}</Link>)}
                  </div>
                )}

                {numbers.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 p-2.5 text-sm sm:grid-cols-3">
                    {numbers.map((n) => <div key={n.k} className="min-w-0"><dt className="text-xs text-muted-foreground">{n.k}</dt><dd className="truncate" title={n.v}>{n.v}</dd></div>)}
                  </dl>
                )}
                {c.sourceUrl && <p className="mt-1 text-xs text-muted-foreground">Numbers from <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">this page</a>.</p>}

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <List title="Where we win" items={c.weWin} tone="text-emerald-700 dark:text-emerald-300" />
                  <List title="Where they win" items={c.theyWin} tone="text-red-700 dark:text-red-300" />
                  <List title="What we would need" items={c.weNeed} tone="text-amber-700 dark:text-amber-300" />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <List title="Key features" items={c.keyFeatures.slice(0, 8)} />
                  {wins.length > 0 && (
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grants, funding and RFPs won ({wins.length})</h4>
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {wins.slice(0, 5).map((w, i) => (
                          <li key={i}>{w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="hover:underline">{w.what}</a> : w.what}{[w.buyer, w.amount, w.year].filter(Boolean).length > 0 && <span className="text-xs text-muted-foreground"> — {[w.buyer, w.amount, w.year].filter(Boolean).join(', ')}</span>}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {customers.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Known customers ({customers.length})</summary>
                    <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                      {customers.map((x, i) => <li key={i} className="py-0.5">{x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="hover:underline">{x.name}</a> : x.name}{x.note && <span className="text-xs text-muted-foreground"> — {x.note}</span>}</li>)}
                    </ul>
                  </details>
                )}
                {c.lessons.length > 0 && <div className="mt-3"><List title="What we can learn from them" items={c.lessons} tone="text-sky-700 dark:text-sky-300" /></div>}
                {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}

                <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <details className="w-full">
                    <summary className="inline-block cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Edit</summary>
                    <div className="mt-3"><CompetitorForm v={{ ...c, customers, wins }} submitLabel="Save changes" /></div>
                  </details>
                  {c.url && (
                    <form action={refreshCompetitorFromWebsite.bind(null, c.id)}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Reading the site…">Refresh from website</SubmitButton>
                    </form>
                  )}
                  <form action={deleteCompetitor.bind(null, c.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">Remove</SubmitButton>
                  </form>
                </footer>
                </div>
              </details>
            )
          })}
        </section>
      )}


      {competitors.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Feature-by-feature matrix (advanced)</summary>
          <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
            Them down the side, our own planned features across the top. Because the columns are the same items we plan against, gaps and moats fall out as a query.
          </p>
          <div className="mt-3 space-y-6">
      {features.length > 0 && (
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

          </div>
        </details>
      )}
    </div>
  )
}
