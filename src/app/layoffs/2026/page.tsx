import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { CiteThisData } from '@/components/layoffs/CiteThisData'
import { MonthBars } from '@/components/layoffs/MonthBars'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { LayoffNumbersNote } from '@/components/layoffs/LayoffNumbersNote'
import { FeedLine } from '@/components/seo/FeedLine'
import { LAYOFF_YEAR, MONTH_MIN_NOTICES, byState, getMonths, getYearNotices, topEmployers } from '@/lib/layoffs/monthly'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { industryPath } from '@/lib/seo/topics'
import { noticeCountsByBucket } from '@/lib/seo/topic-data'
import { getLayoffCounts } from '@/lib/warn/layoff-counts'
import { noticeDay } from '@/lib/warn/layoff-pages'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata('/layoffs/2026')

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'
const n = (v: number) => v.toLocaleString('en-US')

export default async function Layoffs2026Page() {
  const [notices, counts, buckets] = await Promise.all([getYearNotices(), getLayoffCounts(), noticeCountsByBucket().catch(() => new Map<string, number>())])
  const months = await getMonths(notices)
  const workers = notices.reduce((s, x) => s + (x.workers ?? 0), 0)
  const states = byState(notices)
  const employers = topEmployers(notices, 25)
  const industries = [...buckets].sort((a, b) => b[1] - a[1]).slice(0, 14)
  const newest = notices[0]?.noticeDate
  const asOf = counts?.asOf ?? (newest ? noticeDay(newest) : null)
  const modified = (newest ?? new Date()).toISOString().slice(0, 10)
  const headline = `Layoffs ${LAYOFF_YEAR}: ${n(notices.length)} WARN notices so far`
  const faq = [
    { q: `How many layoffs have there been in ${LAYOFF_YEAR}?`, a: `Employers have filed ${n(notices.length)} WARN layoff notices dated ${LAYOFF_YEAR}${workers ? `, naming ${n(workers)} workers` : ''}, across ${states.length} states${asOf ? `, as of ${asOf}` : ''}.${counts ? ` Counted once per employer, state and date, including reported layoffs with a U.S. state, the tracker shows ${n(counts.layoffsYear.layoffs)} layoffs and ${n(counts.layoffsYear.workers)} workers in ${counts.layoffsYear.year}.` : ''}` },
    ...(states[0] ? [{ q: `Which state has the most layoffs in ${LAYOFF_YEAR}?`, a: `${stateName(states[0].state)} has the most workers named in ${LAYOFF_YEAR} WARN notices, ${n(states[0].workers)} across ${n(states[0].notices)} notices.` }] : []),
    ...(employers[0] && employers[0].workers > 0 ? [{ q: `Which company has announced the biggest layoff in ${LAYOFF_YEAR}?`, a: `${employers[0].name} has the most workers named in ${LAYOFF_YEAR} WARN notices: ${n(employers[0].workers)} across ${n(employers[0].notices)} ${employers[0].notices === 1 ? 'notice' : 'notices'}.` }] : []),
    { q: 'What counts as a layoff here?', a: 'A WARN Act notice an employer filed with a state labor department. A notice gives the number of workers and dates the employer reported; it does not say why. Layoffs that are announced but never filed are tracked separately on the layoff tracker.' },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={articleJsonLd({ headline, path: '/layoffs/2026', dateModified: modified, type: 'Article' })} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: `Layoffs ${LAYOFF_YEAR}`, path: '/layoffs/2026' }])} />
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link><span aria-hidden> › </span><span className="text-foreground">Layoffs {LAYOFF_YEAR}</span>
            {asOf && <span className="ml-3">Updated {asOf}</span>}
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1('/layoffs/2026', `Layoffs ${LAYOFF_YEAR}: every WARN notice, month by month`)}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Employers have filed {n(notices.length)} WARN layoff notices dated {LAYOFF_YEAR}{workers ? `, naming ${n(workers)} workers` : ''}, across {states.length} states. Collected daily from state labor departments, with the state’s own record linked on every row.
          </p>
          {counts && (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Including reported layoffs with a U.S. state, counted once per employer, state and date, the <Link href="/layoffs" className={LINK}>layoff tracker</Link> shows {n(counts.layoffsYear.layoffs)} layoffs and {n(counts.layoffsYear.workers)} workers in {counts.layoffsYear.year}.
            </p>
          )}
          <p className="mt-4 text-sm">
            <TrackedLink href="/data/layoffs.csv" event="layoff_csv_downloaded" properties={{ source: 'layoffs-2026:top', path: '/layoffs/2026' }} className="rounded-full bg-brand px-5 py-2 font-semibold text-white hover:opacity-90">
              Download the CSV
            </TrackedLink>
          </p>

          <section aria-labelledby="months" className="mt-12">
            <h2 id="months" className={H2}>Layoffs by month, {LAYOFF_YEAR}</h2>
            <div className="mt-4 rounded-xl border border-border bg-white p-4">
              <MonthBars months={months} label={`Layoffs by month, ${LAYOFF_YEAR}`} />
              <p className="mt-2 text-xs text-muted-foreground">Workers named in WARN notices, by notice date. <Link href="/data/embed" className={LINK}>Put this chart on your site</Link>, for the whole country or any state.</p>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full text-sm">
                <caption className="sr-only">WARN layoff notices by month, {LAYOFF_YEAR}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 font-normal">Month</th>
                    <th scope="col" className="px-4 py-2 text-right font-normal">Notices</th>
                    <th scope="col" className="px-4 py-2 text-right font-normal">Workers named</th>
                    <th scope="col" className="px-4 py-2 font-normal">Largest notice</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.slug} className="border-t">
                      <th scope="row" className="px-4 py-2 text-left font-medium">
                        {m.count >= MONTH_MIN_NOTICES ? <Link href={`/layoffs/2026/${m.slug}`} className={LINK}>{m.name} {LAYOFF_YEAR} layoffs</Link> : `${m.name} ${LAYOFF_YEAR}`}
                      </th>
                      <td className="px-4 py-2 text-right tabular-nums">{n(m.count)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.workers ? n(m.workers) : '—'}</td>
                      <td className="px-4 py-2">{m.top ? <Link href={`/layoffs/company/${m.top.slug}`} className={LINK}>{m.top.employer}</Link> : '—'}{m.top && <span className="text-muted-foreground"> · {n(m.top.workers)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Counted by the date on each filing; a state can publish a notice later, so a month’s count can grow. The current month is partial.</p>
          </section>

          {states.length > 0 && (
            <section aria-labelledby="states" className="mt-12">
              <h2 id="states" className={H2}>Layoffs by state, {LAYOFF_YEAR}</h2>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {states.slice(0, 18).map((s) => (
                  <li key={s.state}>
                    <Link href={`/layoffs/${stateSlug(s.state)}`} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-brand">
                      <span className="font-medium text-navy">{stateName(s.state)} layoffs</span>
                      <span className="tabular-nums text-muted-foreground">{n(s.notices)} {s.notices === 1 ? 'notice' : 'notices'}{s.workers ? ` · ${n(s.workers)} workers` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm"><Link href="/layoffs/by-state" className={LINK}>All states</Link></p>
            </section>
          )}

          {employers.length > 0 && (
            <section aria-labelledby="employers" className="mt-12">
              <h2 id="employers" className={H2}>Companies with the most workers named in {LAYOFF_YEAR} notices</h2>
              <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
                {employers.map((e) => (
                  <li key={e.slug} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/layoffs/company/${e.slug}`} className="font-medium text-navy hover:underline">{e.name} layoffs</Link>
                    <span className="tabular-nums text-muted-foreground">{e.workers > 0 ? `${n(e.workers)} workers · ` : ''}{n(e.notices)} {e.notices === 1 ? 'notice' : 'notices'}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {industries.length > 0 && (
            <section aria-labelledby="industries" className="mt-12">
              <h2 id="industries" className={H2}>Layoffs by industry</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Notices over the last 12 months, grouped by the employer’s industry. Each page adds open jobs and conferences for that industry.</p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {industries.map(([name, count]) => (
                  <li key={name}>
                    <Link href={industryPath(name)} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-brand">
                      <span className="font-medium text-navy">{name} layoffs</span>
                      <span className="tabular-nums text-muted-foreground">{n(count)} notices</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className={H2}>Questions about {LAYOFF_YEAR} layoffs</h2>
            <dl className="mt-4 space-y-4">
              {faq.map((f) => (
                <div key={f.q} className="rounded-xl border border-border bg-white p-4 text-sm">
                  <dt className="font-semibold text-navy">{f.q}</dt>
                  <dd className="mt-1 text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <CiteThisData path="/layoffs/2026" asOf={asOf} source="layoffs-2026" />
          <LayoffNumbersNote counts={counts} />

          <section aria-labelledby="more" className="mt-12 rounded-xl border border-border bg-white p-6">
            <h2 id="more" className="text-xl font-semibold tracking-tight text-navy">More layoff data</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/layoffs/this-week" className={LINK}>Layoffs this week</Link></li>
              <li><Link href="/layoffs/week" className={LINK}>Layoffs by week</Link></li>
              <li><Link href="/data" className={LINK}>Download the WARN record</Link> as CSV or JSON</li>
              <li><FeedLine feed="/feeds/layoffs" label="Get new layoff notices by RSS" /></li>
              <li><Link href="/start/laid-off" className={LINK}>Laid off? Start here</Link></li>
            </ul>
          </section>
          <div className="mt-10"><LayoffAlertForm source="layoffs:2026" /></div>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
