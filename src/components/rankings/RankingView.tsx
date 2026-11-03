import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { MONTH_TINTS } from '@/components/rankings/tones'
import { editionLabel } from '@/lib/rankings/build-edition'
import { editionHref, familyOfRanking } from '@/lib/rankings/awards'
import { employerLinks } from '@/lib/rankings/employer-links'
import { SITE_URL } from '@/lib/seo/facts'
import { getTitleIndex, hasSalaryPage } from '@/lib/seo/job-titles'
import { functionByName, functionPath } from '@/lib/seo/topics'
import type { RankingEdition, RankingIndexEntry, RankRow } from '@/lib/rankings/types'

const CARD = 'rounded-xl border border-border bg-white'

function Change({ change }: { change: number | null }) {
  if (change === null) return null
  if (change === 0) return <span className="text-xs text-muted-foreground" title="Same rank as last month">–</span>
  return <span className={`text-xs font-medium ${change > 0 ? 'text-emerald-700' : 'text-rose-700'}`} title="Places moved since last month">{change > 0 ? '▲' : '▼'} {Math.abs(change)}</span>
}

type Noun = RankingEdition['placeNoun']
const isSkillNoun = (n: Noun) => n === 'skills' || n === 'tools' || n === 'certifications'

/** Where a row's name leads: its place page, or for a skill, tool or certification, the open jobs that name it. */
const linkOf = (row: RankRow, noun: Noun) => row.href ?? (isSkillNoun(noun) ? `/jobs?q=${encodeURIComponent(row.name)}` : null)

function PlaceName({ row, noun, className }: { row: RankRow; noun: Noun; className?: string }) {
  const href = linkOf(row, noun)
  return href ? <Link href={href} className={className ?? LINK}>{row.name}</Link> : <span className={className}>{row.name}</span>
}

/** The bar chart of the top ten, in CSS: no script, readable by any browser. The longest bar is the leader. */
function TopChart({ rows, noun }: { rows: RankRow[]; noun: Noun }) {
  const top = rows.slice(0, 10)
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1e-9)
  return (
    <ol className={`${CARD} space-y-2 p-5`} aria-label="Top ten at a glance">
      {top.map((r) => (
        <li key={r.key} className="grid grid-cols-[1.5rem_minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[1.5rem_12rem_1fr_auto]">
          <span className="tabular-nums text-muted-foreground">{r.rank}</span>
          <span className="truncate font-medium text-navy"><PlaceName row={r} noun={noun} className="hover:underline" /> <span className="font-normal text-muted-foreground">{r.sub}</span></span>
          <span className="h-3 rounded-full bg-muted" aria-hidden><span className="block h-3 rounded-full bg-brand" style={{ width: `${Math.max(3, (Math.abs(r.value) / max) * 100)}%` }} /></span>
          <span className="tabular-nums font-semibold text-navy">{r.valueLabel}</span>
        </li>
      ))}
    </ol>
  )
}

const JUMP_LABEL: Record<Noun, (name: string) => string> = {
  cities: (n) => `Jobs and employers in ${n}`,
  counties: (n) => `${n} job market`,
  skills: (n) => `Open jobs naming ${n}`,
  tools: (n) => `Open jobs naming ${n}`,
  certifications: (n) => `Open jobs naming ${n}`,
}

function RowCard({ row, unit, noun, slug, edition, links }: { row: RankRow; unit: string; noun: Noun; slug: string; edition: string; links: Map<string, string> }) {
  const podium = row.rank <= 3
  const href = linkOf(row, noun)
  return (
    <li className={`rounded-xl p-4 sm:p-5 ${podium ? 'bg-tint-sun' : `${CARD}`}`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${podium ? 'bg-white text-tint-sun-ink' : 'bg-tint-sky text-navy'}`}>{row.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-lg font-semibold text-navy"><PlaceName row={row} noun={noun} /> <span className="text-sm font-normal text-muted-foreground">{row.sub}</span> <Change change={row.change} /></h3>
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
          {row.employers.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Hiring most here:</span>{' '}
              {row.employers.map((name, i) => {
                const to = links.get(name)
                return (
                  <span key={name}>
                    {i > 0 && ', '}
                    {to ? <TrackedLink href={to} event="ranking_employer_link_clicked" properties={{ slug, edition, rank: row.rank, employer: name }} className="text-brand underline underline-offset-2">{name}</TrackedLink> : name}
                  </span>
                )
              })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Based on {row.n.toLocaleString('en-US')} {unit}.</p>
          {href && (
            <p className="mt-2 text-sm">
              <TrackedLink href={href} event="ranking_row_link_clicked" properties={{ slug, edition, rank: row.rank, kind: noun }} className={LINK}>{JUMP_LABEL[noun](row.name)}</TrackedLink>
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

function Movers({ rows }: { rows: RankRow[] }) {
  const hasPrev = rows.some((r) => r.change !== null)
  if (!hasPrev) return null
  const up = rows.filter((r) => (r.change ?? 0) > 0).sort((a, b) => (b.change as number) - (a.change as number) || a.rank - b.rank).slice(0, 4)
  const down = rows.filter((r) => (r.change ?? 0) < 0).sort((a, b) => (a.change as number) - (b.change as number) || a.rank - b.rank).slice(0, 4)
  const fresh = rows.filter((r) => r.rank <= 25 && r.change === null).slice(0, 4)
  if (!up.length && !down.length && !fresh.length) return null
  const col = (title: string, list: RankRow[], tone: string, mark: (r: RankRow) => string) =>
    list.length > 0 && (
      <div className={`rounded-xl p-4 ${tone}`}>
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {list.map((r) => <li key={r.key} className="flex justify-between gap-3"><span className="text-foreground">{r.name} <span className="text-muted-foreground">{r.sub}</span></span><span className="shrink-0 tabular-nums font-medium text-navy">{mark(r)}</span></li>)}
        </ul>
      </div>
    )
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {col('Climbed the most', up, 'bg-white', (r) => `▲ ${r.change} to #${r.rank}`)}
      {col('Slipped the most', down, 'bg-white', (r) => `▼ ${Math.abs(r.change as number)} to #${r.rank}`)}
      {col('New in the top 25', fresh, 'bg-white', (r) => `#${r.rank}`)}
    </div>
  )
}

/** The jobs behind a list about one job family: its page, its top employers, its most common titles and their pay. */
async function FamilyLinks({ fn, slug, edition }: { fn: string; slug: string; edition: string }) {
  const topic = functionByName(fn)
  const titles = (await getTitleIndex().catch(() => [])).filter((t) => t.fn === fn).sort((a, b) => b.jobs - a.jobs).slice(0, 8)
  if (!topic && !titles.length) return null
  const lowered = (topic?.name ?? fn).toLowerCase()
  const track = (to: string) => ({ slug, edition, fn, to })
  return (
    <section aria-labelledby="jobs-behind" className="mt-12">
      <h2 id="jobs-behind" className={H2}>The jobs behind this ranking</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Open {lowered} jobs, who is hiring for them and what they pay.</p>
      <ul className="mt-4 flex flex-wrap gap-2 text-sm">
        {topic && <li><TrackedLink href={functionPath(topic.name)} event="ranking_family_link_clicked" properties={track(functionPath(topic.name))} className="inline-flex rounded-full bg-white px-3 py-1.5 font-medium text-navy hover:underline">{topic.name} jobs</TrackedLink></li>}
        {topic && <li><TrackedLink href={`/top-employers/${topic.slug}`} event="ranking_family_link_clicked" properties={track(`/top-employers/${topic.slug}`)} className="inline-flex rounded-full bg-white px-3 py-1.5 font-medium text-navy hover:underline">Top {topic.name} employers</TrackedLink></li>}
        {titles.map((t) => (
          <li key={t.slug}>
            <TrackedLink href={hasSalaryPage(t) ? `/salaries/${t.slug}` : `/jobs/title/${t.slug}`} event="ranking_family_link_clicked" properties={track(`/jobs/title/${t.slug}`)} className="inline-flex gap-2 rounded-full bg-white px-3 py-1.5 text-navy hover:underline">
              {t.name} <span className="tabular-nums text-muted-foreground">{t.jobs.toLocaleString('en-US')}</span>
            </TrackedLink>
          </li>
        ))}
      </ul>
      {titles.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Job titles link to their salary page where pay is posted, otherwise to the open jobs.</p>}
    </section>
  )
}

/** Every month this list has been published, linked: the archive for this one ranking. */
function MonthByMonth({ e, entry }: { e: RankingEdition; entry: RankingIndexEntry | undefined }) {
  const editions = entry?.editions ?? [e.edition]
  if (editions.length < 2 && (entry?.edition ?? e.edition) === e.edition) return null
  return (
    <section aria-labelledby="archive" className="mt-12">
      <h2 id="archive" className={H2}>Month by month</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Every edition of this ranking stays online at its own address, so you can see how the list has moved.</p>
      <ul className="mt-4 flex flex-wrap gap-2 text-sm">
        {editions.map((ed, i) => (
          <li key={ed}>
            {ed === e.edition ? (
              <span aria-current="page" className="inline-flex rounded-full bg-navy px-3 py-1.5 font-medium text-white">{editionLabel(ed)}</span>
            ) : (
              <TrackedLink href={editionHref(e.slug, ed, entry?.edition)} event="ranking_edition_link_clicked" properties={{ slug: e.slug, from: e.edition, to: ed }} className={`inline-flex rounded-full px-3 py-1.5 font-medium text-navy hover:underline ${MONTH_TINTS[i % MONTH_TINTS.length]}`}>{editionLabel(ed)}</TrackedLink>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm"><Link href="/rankings/archive" className={LINK}>Browse every ranking by month</Link></p>
    </section>
  )
}

export async function RankingView({ e, index, latest }: { e: RankingEdition; index: RankingIndexEntry[]; latest: boolean }) {
  const path = `/rankings/${e.slug}`
  const label = editionLabel(e.edition)
  const unit = e.measure === 'swe' ? 'engineering openings' : e.measure === 'paycost' ? 'openings with pay posted' : e.unit
  const entry = index.find((x) => x.slug === e.slug)
  const sameScope = index.filter((x) => x.slug !== e.slug && x.scopeKind === e.scope.kind && x.scopeId === e.scope.id).slice(0, 6)
  const sameMeasure = index.filter((x) => x.slug !== e.slug && x.measure === e.measure && x.scopeKind !== e.scope.kind).slice(0, 6)
  const url = `${SITE_URL}${latest ? path : `${path}/${e.edition}`}`
  const fn = entry ? familyOfRanking(entry) : null
  const employers = await employerLinks(e.rows.slice(0, 25).flatMap((r) => r.employers))
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
      look="scene"
      trail={[{ name: 'Rankings', path: '/rankings' }, { name: e.title, path }]}
      h1={e.h1}
      jsonLd={ld}
      lede={<><span className="block text-base font-medium text-navy">{e.lead}</span><span className="mt-2 block text-sm">{label} edition. Updated monthly, from {e.placeNoun === 'counties' ? 'public Bureau of Labor Statistics and Census data' : 'open jobs we verified on employer career sites'}.{!latest && entry && <> This is an earlier edition: <Link href={path} className={LINK}>see the latest</Link>.</>}</span></>}
    >
      <section aria-labelledby="facts" className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className={`${CARD} p-5`}>
          <h2 id="facts" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key facts</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground">{e.keyFacts.map((f) => <li key={f}>{f}</li>)}</ul>
          {e.baseline && <p className="mt-3 text-xs text-muted-foreground">For comparison: {e.baseline.valueLabel} across {e.baseline.label}.</p>}
        </div>
        <TopChart rows={e.rows} noun={e.placeNoun} />
      </section>

      <section aria-labelledby="stands-out">
        <h2 id="stands-out" className={H2}>What stands out</h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm text-foreground">{e.commentary.map((c) => <li key={c}>{c}</li>)}</ul>
        <Movers rows={e.rows} />
      </section>

      <section aria-labelledby="top">
        <h2 id="top" className={H2}>The top 25</h2>
        <ol className="mt-4 space-y-3">{e.rows.slice(0, 25).map((r) => <RowCard key={r.key} row={r} unit={unit} noun={e.placeNoun} slug={e.slug} edition={e.edition} links={employers} />)}</ol>
      </section>

      <section aria-labelledby="full">
        <h2 id="full" className={H2}>Full ranking</h2>
        <p className="mt-2 text-sm text-muted-foreground">All {e.rows.length} {e.placeNoun} that qualified, with the figure each is ranked on.</p>
        <div className={`${CARD} mt-4 overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">{{ cities: 'City', counties: 'County', skills: 'Skill', tools: 'Tool', certifications: 'Certification' }[e.placeNoun]}</th><th className="px-4 py-3 text-right">Score</th><th className="px-4 py-3 text-right">Sample</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {e.rows.map((r) => (
                <tr key={r.key}>
                  <td className="px-4 py-2 tabular-nums">{r.rank}</td>
                  <td className="px-4 py-2"><PlaceName row={r} noun={e.placeNoun} /> <span className="text-muted-foreground">{r.sub}</span></td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{r.valueLabel}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.n.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {fn && <FamilyLinks fn={fn} slug={e.slug} edition={e.edition} />}

      <MonthByMonth e={e} entry={entry} />

      <section aria-labelledby="method">
        <h2 id="method" className={H2}>How this ranking works</h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm text-foreground">
          {e.method.map((m) => <p key={m}>{m}</p>)}
          <p><span className="font-medium">Sample bar:</span> {e.placeNoun} with fewer than {e.minN.toLocaleString('en-US')} {unit} are not ranked.</p>
          <p><span className="font-medium">Sources:</span> {e.sources.join('; ')}. Data as of {label}.</p>
          <p className="text-muted-foreground">Our job data covers professional roles on the career sites of employers we track, so figures describe that market, not every job. Spot an error? <Link href="/contact" className={LINK}>Tell us</Link>.</p>
        </div>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className={H2}>Questions</h2>
        <dl className="mt-3 max-w-3xl space-y-4 text-sm">{e.faq.map((f) => <div key={f.q}><dt className="font-semibold text-navy">{f.q}</dt><dd className="mt-1 text-foreground">{f.a}</dd></div>)}</dl>
      </section>

      {(sameScope.length > 0 || sameMeasure.length > 0) && (
        <section aria-labelledby="more">
          <h2 id="more" className={H2}>More rankings</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[...sameScope, ...sameMeasure].map((x) => <li key={x.slug}><Link href={`/rankings/${x.slug}`} className={LINK}>{x.title}</Link></li>)}
            <li><Link href="/rankings" className={LINK}>All rankings</Link></li>
          </ul>
        </section>
      )}

      <section aria-labelledby="cite">
        <h2 id="cite" className={H2}>Cite this ranking</h2>
        <p className={`${CARD} mt-3 max-w-3xl p-4 text-sm text-foreground`}>NextChapter, “{e.title},” {label} edition. {url}</p>
        <p className="mt-3 text-sm text-muted-foreground">Link to it: <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{`<a href="${SITE_URL}${path}">${e.title} (NextChapter, ${label})</a>`}</code></p>
        <p className="mt-3 text-sm">Download the data: <a href={`${path}/latest.csv`} className={LINK}>CSV</a> · <a href={`${path}/latest.json`} className={LINK}>JSON</a>. Free to use with a link back.</p>
      </section>

      <div className="mt-12"><NewsletterSignup source="rankings" /></div>
    </SeoPage>
  )
}
