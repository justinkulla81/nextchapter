import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { editionLabel } from '@/lib/rankings/build-edition'
import { SITE_URL } from '@/lib/seo/facts'
import type { RankingEdition, RankingIndexEntry, RankRow } from '@/lib/rankings/types'

const CARD = 'rounded-xl border border-border bg-white'

function Change({ change }: { change: number | null }) {
  if (change === null) return null
  if (change === 0) return <span className="text-xs text-muted-foreground" title="Same rank as last month">–</span>
  return <span className={`text-xs font-medium ${change > 0 ? 'text-emerald-700' : 'text-rose-700'}`} title="Places moved since last month">{change > 0 ? '▲' : '▼'} {Math.abs(change)}</span>
}

function PlaceName({ row, className }: { row: RankRow; className?: string }) {
  return row.href ? <Link href={row.href} className={className ?? LINK}>{row.name}</Link> : <span className={className}>{row.name}</span>
}

/** The bar chart of the top ten, in CSS: no script, readable by any browser. The longest bar is the leader. */
function TopChart({ rows }: { rows: RankRow[] }) {
  const top = rows.slice(0, 10)
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1e-9)
  const barOf = (r: RankRow) => r.bar ?? Math.abs(r.value) / max
  return (
    <ol className={`${CARD} space-y-2 p-5`} aria-label="Top ten at a glance">
      {top.map((r) => (
        <li key={r.key} className="grid grid-cols-[1.5rem_minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[1.5rem_12rem_1fr_auto]">
          <span className="tabular-nums text-muted-foreground">{r.rank}</span>
          <span className="truncate font-medium text-navy"><PlaceName row={r} className="hover:underline" /> <span className="font-normal text-muted-foreground">{r.sub}</span></span>
          <span className="h-3 rounded-full bg-muted" aria-hidden><span className="block h-3 rounded-full bg-brand" style={{ width: `${Math.max(3, barOf(r) * 100)}%` }} /></span>
          <span className="tabular-nums font-semibold text-navy">{r.valueLabel}</span>
        </li>
      ))}
    </ol>
  )
}

function RowCard({ row, unit }: { row: RankRow; unit: string }) {
  return (
    <li className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-sky text-base font-bold text-navy">{row.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-lg font-semibold text-navy"><PlaceName row={row} /> <span className="text-sm font-normal text-muted-foreground">{row.sub}</span> <Change change={row.change} /></h3>
            <p className="text-2xl font-bold tabular-nums text-navy">{row.valueLabel}</p>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            {row.stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-medium text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
          {row.employers.length > 0 && <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Hiring most here:</span> {row.employers.join(', ')}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Based on {row.n.toLocaleString('en-US')} {unit}.</p>
        </div>
      </div>
    </li>
  )
}

export function RankingView({ e, index, latest }: { e: RankingEdition; index: RankingIndexEntry[]; latest: boolean }) {
  const path = `/rankings/${e.slug}`
  const label = editionLabel(e.edition)
  const unit = e.measure === 'swe' ? 'engineering openings' : e.measure === 'paycost' ? 'openings with pay posted' : e.measure === 'collegepay' ? 'students enrolled' : e.measure === 'lowunemp' || e.measure === 'unempdrop' || e.measure === 'whitecollar' ? 'people in the labor force' : e.unit
  const sameScope = index.filter((x) => x.slug !== e.slug && x.scopeKind === e.scope.kind && x.scopeId === e.scope.id).slice(0, 6)
  const sameMeasure = index.filter((x) => x.slug !== e.slug && x.measure === e.measure && x.scopeKind !== e.scope.kind).slice(0, 6)
  const url = `${SITE_URL}${latest ? path : `${path}/${e.edition}`}`
  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: e.title, url, numberOfItems: e.rows.length,
      itemListElement: e.rows.slice(0, 25).map((r) => ({ '@type': 'ListItem', position: r.rank, name: `${r.name}, ${r.sub}`, ...(r.href ? { url: `${SITE_URL}${r.href}` } : {}) })),
    },
    {
      '@context': 'https://schema.org', '@type': 'Dataset', name: `${e.title}, ${label}`, description: e.lead, url, dateModified: e.builtAt.slice(0, 10), temporalCoverage: e.edition,
      creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL }, isAccessibleForFree: true,
      measurementTechnique: e.method.join(' '), citation: e.sources,
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: e.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <SeoPage
      trail={[{ name: 'Rankings', path: '/rankings' }, { name: e.title, path }]}
      h1={e.h1}
      jsonLd={ld}
      lede={<><span className="block text-base font-medium text-navy">{e.lead}</span><span className="mt-2 block text-sm">{label} edition. Updated monthly, from {e.placeNoun === 'counties' ? 'public Bureau of Labor Statistics and Census data' : 'open jobs we verified on employer career sites'}.</span></>}
    >
      <section aria-labelledby="facts" className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className={`${CARD} p-5`}>
          <h2 id="facts" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key facts</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground">{e.keyFacts.map((f) => <li key={f}>{f}</li>)}</ul>
          {e.baseline && <p className="mt-3 text-xs text-muted-foreground">For comparison: {e.baseline.valueLabel} across {e.baseline.label}.</p>}
        </div>
        <TopChart rows={e.rows} />
      </section>

      <section aria-labelledby="stands-out" className="mt-10">
        <h2 id="stands-out" className={H2}>What stands out</h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm text-foreground">{e.commentary.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <section aria-labelledby="top" className="mt-12">
        <h2 id="top" className={H2}>The top 25</h2>
        <ol className="mt-4 space-y-3">{e.rows.slice(0, 25).map((r) => <RowCard key={r.key} row={r} unit={unit} />)}</ol>
      </section>

      <section aria-labelledby="full" className="mt-12">
        <h2 id="full" className={H2}>Full ranking</h2>
        <p className="mt-2 text-sm text-muted-foreground">All {e.rows.length} {e.placeNoun} that qualified, with the figure each is ranked on.</p>
        <div className={`${CARD} mt-4 overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">{{ cities: 'City', counties: 'County', skills: 'Skill', tools: 'Tool', certifications: 'Certification', colleges: 'College' }[e.placeNoun]}</th><th className="px-4 py-3 text-right">Score</th><th className="px-4 py-3 text-right">Sample</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {e.rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2 tabular-nums">{r.rank}</td>
                  <td className="px-4 py-2"><PlaceName row={r} /> <span className="text-muted-foreground">{r.sub}</span></td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{r.valueLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.n.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="method" className="mt-12">
        <h2 id="method" className={H2}>How this ranking works</h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm text-foreground">
          {e.method.map((m) => <p key={m}>{m}</p>)}
          <p><span className="font-medium">Sample bar:</span> {e.placeNoun} with fewer than {e.minN.toLocaleString('en-US')} {unit} are not ranked.</p>
          <p><span className="font-medium">Sources:</span> {e.sources.join('; ')}. Data as of {label}.</p>
          <p className="text-muted-foreground">Our job data covers professional roles on the career sites of employers we track, so figures describe that market, not every job. Spot an error? <Link href="/contact" className={LINK}>Tell us</Link>.</p>
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions</h2>
        <dl className="mt-3 max-w-3xl space-y-4 text-sm">{e.faq.map((f) => <div key={f.q}><dt className="font-semibold text-navy">{f.q}</dt><dd className="mt-1 text-foreground">{f.a}</dd></div>)}</dl>
      </section>

      {(sameScope.length > 0 || sameMeasure.length > 0) && (
        <section aria-labelledby="more" className="mt-12">
          <h2 id="more" className={H2}>More rankings</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[...sameScope, ...sameMeasure].map((x) => <li key={x.slug}><Link href={`/rankings/${x.slug}`} className={LINK}>{x.title}</Link></li>)}
            <li><Link href="/rankings" className={LINK}>All rankings</Link></li>
          </ul>
        </section>
      )}

      <section aria-labelledby="cite" className="mt-12">
        <h2 id="cite" className={H2}>Cite this ranking</h2>
        <p className={`${CARD} mt-3 max-w-3xl p-4 text-sm text-foreground`}>NextChapter, “{e.title},” {label} edition. {url}</p>
        <p className="mt-3 text-sm text-muted-foreground">Link to it: <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{`<a href="${SITE_URL}${path}">${e.title} (NextChapter, ${label})</a>`}</code></p>
        <p className="mt-3 text-sm">Download the data: <a href={`${path}/latest.csv`} className={LINK}>CSV</a> · <a href={`${path}/latest.json`} className={LINK}>JSON</a>. Free to use with a link back.</p>
      </section>

      <div className="mt-12"><NewsletterSignup source="rankings" /></div>
    </SeoPage>
  )
}
