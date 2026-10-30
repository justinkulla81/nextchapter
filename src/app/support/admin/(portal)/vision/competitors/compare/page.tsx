import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { PORTAL_ORDER, PORTAL_PLAN_LABELS, plansForFamily, plansForPortal } from '@/lib/marketing/plans'
import { EVENT_LABEL, type EventKind } from '@/lib/vision/competitor-watch-core'
import { RELATIONSHIPS, relationshipLabel } from '@/lib/vision/competitor-areas'

export const maxDuration = 60

const V = '/support/admin/vision/competitors'
const PRESENCE: EventKind[] = ['BOOTH', 'SPONSOR', 'SPEAKING', 'PODCAST']

/**
 * What we charge, where an amount has been decided. The website shows plans, never prices (owner decision 2026-10-23), so this
 * is the only place an amount appears. Source: docs/specs/plans-and-pricing-structure.md. Anything not listed is not decided yet.
 */
const OUR_PRICE: Record<string, string> = {
  outplacement: 'Per seat, 6 to 24 month term: Core $895, Plus $2,450, Premium $7,450. Volume discount 10% at 25 seats, 18% at 100, 25% at 250.',
  hiring: 'Monthly by tier, about $200 and $500 to $600 noted in the schema; owner to confirm.',
  recruiters: 'Free for now.',
  coaches: 'Free for now.',
}

function money(n: number | null): string {
  if (!n) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`
  return `$${n.toLocaleString()}`
}
const year = (d: Date | null) => (d ? String(d.getUTCFullYear()) : '')

export default async function CompetitorComparePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const rel = sp.rel && RELATIONSHIPS.some((r) => r.key === sp.rel) ? sp.rel : ''

  const [events, cards] = await Promise.all([
    prisma.competitorEvent.findMany({ where: { kind: { in: PRESENCE } }, orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], take: 3000 }),
    prisma.productCompetitor.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true, url: true, relationship: true, fundingRaisedUsd: true, lastRound: true, investors: true, pricingNote: true, weWin: true, theyWin: true, weNeed: true } }),
  ])
  const by = new Map(cards.map((c) => [c.id, c]))
  const inScope = (id: string) => { const c = by.get(id); return !!c && (!rel || c.relationship === rel) }
  const shownEvents = events.filter((e) => inScope(e.competitorId))

  // Conferences: one row per event name, with who exhibited, sponsored or spoke.
  const norm = (t: string) => t.toLowerCase().replace(/\b20\d\d\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const confs = new Map<string, { title: string; items: { competitor: string; id: string; kind: EventKind; detail: string | null; url: string | null; year: string }[] }>()
  for (const e of shownEvents.filter((x) => x.kind !== 'PODCAST')) {
    const k = norm(e.title); const cur = confs.get(k) ?? { title: e.title.replace(/\s*20\d\d\s*$/, ''), items: [] }
    cur.items.push({ competitor: by.get(e.competitorId)!.name, id: e.competitorId, kind: e.kind as EventKind, detail: e.summary, url: e.url, year: year(e.occurredAt) })
    confs.set(k, cur)
  }
  const confRows = [...confs.values()].sort((a, b) => new Set(b.items.map((i) => i.id)).size - new Set(a.items.map((i) => i.id)).size || a.title.localeCompare(b.title))
  const pods = shownEvents.filter((x) => x.kind === 'PODCAST')
  const perCompany = new Map<string, number>()
  for (const e of shownEvents) perCompany.set(e.competitorId, (perCompany.get(e.competitorId) ?? 0) + 1)
  const mostActive = [...perCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)

  const rivals = cards.filter((c) => (!rel ? c.relationship === 'DIRECT' || c.relationship === 'ADJACENT' : c.relationship === rel))
  const href = (r: string) => `${V}/compare${r ? `?rel=${r}` : ''}`
  const pill = (on: boolean) => `rounded-md border px-2.5 py-1 text-sm ${on ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted'}`
  const link = (id: string) => `${V}?focus=${id}#c-${id}`

  return (
    <div className="space-y-8">
      <nav className="text-sm"><Link href={V} className="text-muted-foreground hover:underline">← Competitors</Link> · <Link href={`${V}?view=table`} className="underline">Sortable table</Link></nav>
      <header>
        <h1 className="text-2xl font-semibold">Competitors next to us</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Where they exhibit, sponsor, speak and guest on podcasts; what they have raised; and what they charge beside our plans. Every item links to the page it came from. Presence items from the web are read by a model, so check one before you act on it.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Relationship">
          <Link href={href('')} className={pill(!rel)}>Direct and adjacent</Link>
          {RELATIONSHIPS.map((r) => <Link key={r.key} href={href(r.key)} className={pill(rel === r.key)}>{r.label}</Link>)}
        </div>
      </header>

      <section aria-labelledby="where" className="space-y-3">
        <h2 id="where" className="text-lg font-semibold">Where they show up</h2>
        {confRows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No booths, sponsorships or speaking slots on file for this group yet.</p> : (
          <>
            <p className="text-sm text-muted-foreground">{confRows.length} events, {shownEvents.filter((e) => e.kind !== 'PODCAST').length} appearances. Events with the most rivals first: those are the rooms where we are being compared.</p>
            <div className="divide-y divide-border rounded-xl border border-border">
              {confRows.slice(0, 80).map((c) => (
                <div key={c.title} className="p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium">{c.title}</h3><span className="text-xs text-muted-foreground">{new Set(c.items.map((i) => i.id)).size} rival{new Set(c.items.map((i) => i.id)).size === 1 ? '' : 's'}</span></div>
                  <ul className="mt-1 space-y-0.5">
                    {c.items.map((i, n) => (
                      <li key={n} className="flex flex-wrap gap-x-2"><Link href={link(i.id)} className="font-medium hover:underline">{i.competitor}</Link><span className="text-muted-foreground">{EVENT_LABEL[i.kind]}{i.year ? `, ${i.year}` : ''}{i.detail ? `: ${i.detail}` : ''}</span>{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-muted-foreground underline">source</a>}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {confRows.length > 80 && <p className="text-xs text-muted-foreground">Showing the 80 events with the most rivals of {confRows.length}.</p>}
          </>
        )}
        {mostActive.length > 0 && (
          <p className="text-sm"><span className="text-muted-foreground">Most visible:</span> {mostActive.map(([id, n], i) => <span key={id}>{i ? ', ' : ''}<Link href={link(id)} className="hover:underline">{by.get(id)!.name}</Link> ({n})</span>)}</p>
        )}
      </section>

      <section aria-labelledby="pods" className="space-y-2">
        <h2 id="pods" className="text-lg font-semibold">Podcasts</h2>
        {pods.length === 0 ? <p className="text-sm text-muted-foreground">No podcast appearances on file for this group yet.</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {pods.slice(0, 60).map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2 p-2.5"><Link href={link(e.competitorId)} className="font-medium hover:underline">{by.get(e.competitorId)!.name}</Link><span className="text-muted-foreground">{e.summary ? `${e.summary}: ` : ''}{e.title}{e.occurredAt ? `, ${year(e.occurredAt)}` : ''}</span>{e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-muted-foreground underline">listen</a>}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="funding" className="space-y-2">
        <h2 id="funding" className="text-lg font-semibold">Funding and price, side by side</h2>
        <p className="text-sm text-muted-foreground">{rivals.length} companies. Funding is what each has raised and its last round; price is what they publish. A dash means we have not found a public figure.</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-2 py-2">Company</th><th className="px-2 py-2">Type</th><th className="px-2 py-2 text-right">Raised</th><th className="px-2 py-2">Last round and investors</th><th className="px-2 py-2">Their price</th><th className="px-2 py-2">Where they beat us</th><th className="px-2 py-2">Where we win</th></tr>
            </thead>
            <tbody className="divide-y divide-border align-top">
              {rivals.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1.5 font-medium"><Link href={link(c.id)} className="hover:underline">{c.name}</Link>{c.url && <a href={c.url} target="_blank" rel="noreferrer" aria-label={`${c.name} website`} className="ml-1 text-muted-foreground">↗</a>}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{relationshipLabel(c.relationship)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{money(c.fundingRaisedUsd)}</td>
                  <td className="px-2 py-1.5 text-xs">{[c.lastRound, c.investors].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-2 py-1.5 text-xs">{c.pricingNote ?? '—'}</td>
                  <td className="px-2 py-1.5 text-xs">{[...c.theyWin, ...c.weNeed].slice(0, 2).join('; ') || '—'}</td>
                  <td className="px-2 py-1.5 text-xs">{c.weWin.slice(0, 2).join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ours" className="space-y-2">
        <h2 id="ours" className="text-lg font-semibold">Our plans and what we charge</h2>
        <p className="text-sm text-muted-foreground">From our plan list. The website names plans and shows no amounts; the amounts below are the ones decided so far, from the pricing spec. A dash means not decided.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[{ key: 'individual', title: 'Individuals', blurb: 'People between jobs.', plans: plansForFamily('individual') }, ...PORTAL_ORDER.map((p) => ({ key: p, title: PORTAL_PLAN_LABELS[p].title, blurb: PORTAL_PLAN_LABELS[p].blurb, plans: plansForPortal(p) }))].map((g) => (
            <div key={g.key} className="rounded-xl border border-border p-3 text-sm">
              <h3 className="font-medium">{g.title}</h3>
              <p className="text-xs text-muted-foreground">{g.blurb}</p>
              <p className="mt-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price </span>{OUR_PRICE[g.key] ?? '—'}</p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">{g.plans.map((pl) => <li key={pl.planKey}><span className="font-medium text-foreground">{pl.name}</span>{pl.free ? ' (free)' : ''}: {pl.includes.slice(0, 3).join(', ')}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
