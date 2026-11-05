import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CiteThisData } from '@/components/layoffs/CiteThisData'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { PressCopy } from '@/components/press/PressCopy'
import { PressDownload } from '@/components/press/PressDownload'
import { StructuredData } from '@/components/StructuredData'
import { getRelease, listReleases } from '@/lib/press/layoff-release'
import { RELEASE_MIN_NOTICES, type Comparison } from '@/lib/press/layoff-release-core'
import { PRESS_CONTACT_EMAIL } from '@/lib/press/figures'
import { articleJsonLd, breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600 // 6 hours
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'
const n = (v: number) => v.toLocaleString('en-US')
const pct = (v: number | null) => (v === null ? '—' : v > 0 ? `+${v}%` : v < 0 ? `−${Math.abs(v)}%` : '0%')

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const { month } = await params
  const r = await getRelease(month)
  if (!r) return { title: 'Release not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${r.label} Layoff Data Release: ${n(r.notices)} Notices`),
    description: `${r.findings[0]} Tables by state and employer, a CSV of every notice and the method, free to cite.`.slice(0, 165),
    alternates: { canonical: `/press/layoffs/${r.slug}` },
    robots: { index: !r.partial && r.notices >= RELEASE_MIN_NOTICES, follow: true },
  }
}

function CompareRow({ c, current }: { c: Comparison; current: { notices: number; workers: number } }) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2 font-medium text-navy">{c.label}</td>
      <td className="px-4 py-2 text-right tabular-nums">{n(c.notices)}</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{pct(c.noticesPct)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{c.workers ? n(c.workers) : '—'}</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{current.workers ? pct(c.workersPct) : '—'}</td>
    </tr>
  )
}

export default async function LayoffReleasePage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  const [r, all] = await Promise.all([getRelease(month), listReleases()])
  if (!r) notFound()
  const path = `/press/layoffs/${r.slug}`
  const csv = `${path}/layoffs.csv`
  const asOf = r.rows.reduce((m, x) => (x.fetchedAt > m ? x.fetchedAt : m), r.rows[0].fetchedAt).toISOString().slice(0, 10)
  const idx = all.findIndex((x) => x.slug === r.slug)
  const newer = idx > 0 ? all[idx - 1] : null
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null
  const findingsText = r.findings.join(' ')

  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `US layoff notices dated ${r.label}`,
    description: `${r.findings[0]} One row per filing, with the state's own source link.`,
    url: `${SITE_URL}${path}`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: organizationRef(),
    isAccessibleForFree: true,
    temporalCoverage: `${r.year}-${String(r.month + 1).padStart(2, '0')}`,
    spatialCoverage: 'United States',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}${csv}` }],
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={dataset} />
      <StructuredData data={articleJsonLd({ headline: `${r.label} layoff data release: ${n(r.notices)} layoff notices`, path, dateModified: asOf, type: 'Article' })} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Press and data', path: '/press' }, { name: 'Layoff data for reporters', path: '/press/layoffs' }, { name: r.label, path }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-8">
        <div className="mx-auto max-w-4xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/press" className="hover:text-foreground">Press and data</Link><span aria-hidden> › </span>
            <Link href="/press/layoffs" className="hover:text-foreground">Layoff data for reporters</Link><span aria-hidden> › </span>
            <span className="text-foreground">{r.label}</span>
          </nav>
          <p className="mt-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Layoff data release · data as of {asOf}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{r.label}: {n(r.notices)} layoff notices{r.workers ? `, ${n(r.workers)} people named` : ''}</h1>
          {r.partial && <p className="mt-3 rounded-lg bg-white p-3 text-sm text-muted-foreground">{r.label} is not over, so these counts will grow. Quote the full month once it closes.</p>}

          <section aria-labelledby="findings" className="mt-8 rounded-xl border border-border bg-white p-6">
            <h2 id="findings" className="text-xl font-semibold tracking-tight text-navy">Key findings</h2>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink">
              {r.findings.map((f) => (
                <li key={f} className="flex items-start gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{f}</li>
              ))}
            </ul>
            <div className="mt-4">
              <PressCopy text={findingsText} kind="cite" id={`layoff-release-${r.slug}-findings`} label="Copy findings" />
            </div>
          </section>

          {(r.vsPrevious || r.vsLastYear) && (
            <section aria-labelledby="compare" className="mt-10">
              <h2 id="compare" className={H2}>Against other months</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Month</th>
                      <th className="px-4 py-2 text-right font-medium">Notices</th>
                      <th className="px-4 py-2 text-right font-medium">{r.label} vs</th>
                      <th className="px-4 py-2 text-right font-medium">People named</th>
                      <th className="px-4 py-2 text-right font-medium">{r.label} vs</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border bg-off-white">
                      <td className="px-4 py-2 font-semibold text-navy">{r.label}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{n(r.notices)}</td><td />
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.workers ? n(r.workers) : '—'}</td><td />
                    </tr>
                    {r.vsPrevious && <CompareRow c={r.vsPrevious} current={r} />}
                    {r.vsLastYear && <CompareRow c={r.vsLastYear} current={r} />}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="states" className="mt-10">
            <h2 id="states" className={H2}>By state</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[420px] text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">State</th><th className="px-4 py-2 text-right font-medium">Notices</th><th className="px-4 py-2 text-right font-medium">People named</th></tr></thead>
                <tbody>
                  {r.topStates.map((s) => (
                    <tr key={s.state} className="border-t border-border">
                      <td className="px-4 py-2 font-medium text-navy">{stateName(s.state)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{n(s.notices)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{s.workers ? n(s.workers) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.states > r.topStates.length && <p className="mt-2 text-sm text-muted-foreground">Top {r.topStates.length} of {r.states} states by notices. All of them are in the CSV.</p>}
          </section>

          <section aria-labelledby="employers" className="mt-10">
            <h2 id="employers" className={H2}>Largest employers</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[420px] text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">Employer</th><th className="px-4 py-2 text-right font-medium">Notices</th><th className="px-4 py-2 text-right font-medium">People named</th></tr></thead>
                <tbody>
                  {r.topEmployers.map((e) => (
                    <tr key={e.slug} className="border-t border-border">
                      <td className="px-4 py-2"><Link href={`/layoffs/company/${e.slug}`} className="font-medium text-navy hover:underline">{e.name}</Link></td>
                      <td className="px-4 py-2 text-right tabular-nums">{n(e.notices)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{e.workers ? n(e.workers) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Ranked by people named, then notices.</p>
          </section>

          <section aria-labelledby="files" className="mt-10 rounded-xl border border-border bg-white p-6">
            <h2 id="files" className="text-xl font-semibold tracking-tight text-navy">Download the data</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><PressDownload href={csv} id={`layoff-release-${r.slug}-csv`}>{r.label} layoff notices (CSV)</PressDownload> <span className="text-muted-foreground">· {n(r.notices)} rows, one per filing, with the state’s own source link</span></li>
              <li><PressDownload href="/data/layoffs.csv" id={`layoff-release-${r.slug}-all-csv`}>All layoff notices, last 24 months (CSV)</PressDownload></li>
              <li><PressDownload href="/data/layoffs.json" id={`layoff-release-${r.slug}-all-json`}>All layoff notices, last 24 months (JSON)</PressDownload></li>
            </ul>
          </section>

          <section aria-labelledby="method" className="mt-10">
            <h2 id="method" className={H2}>How these numbers are counted</h2>
            <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink">
              <li>Each notice is counted in the month of the date on the filing. A state can publish a notice days or weeks later, so a month’s count can still grow after it closes.</li>
              <li>The notices are the state WARN filings and reported layoffs we have collected. A notice list is a floor, not a count of every layoff: employers below the WARN size thresholds, and layoffs that no state has published, are not in it.</li>
              <li>“People named” adds up the headcounts the notices state. {n(r.noticesWithHeadcount)} of the {n(r.notices)} notices state one, so the total is a floor.</li>
              <li>Some states publish only an effective date. For those we use that date minus the 60 days WARN requires, so those notices sit in a month that is an estimate.</li>
              <li>The same counts appear on <Link href={`/layoffs/${r.year}/${['january','february','march','april','may','june','july','august','september','october','november','december'][r.month]}`} className={LINK}>the month page</Link> and in the <Link href="/layoffs" className={LINK}>layoff tracker</Link>.</li>
            </ul>
          </section>

          <CiteThisData path={path} asOf={asOf} source={`layoff-release-${r.slug}`} csvHref={csv} />

          <section aria-labelledby="contact" className="mt-10 text-sm leading-relaxed text-muted-foreground">
            <h2 id="contact" className="text-base font-semibold text-navy">Questions and corrections</h2>
            <p className="mt-2 max-w-3xl">Reporters can write to <a href={`mailto:${PRESS_CONTACT_EMAIL}`} className={LINK}>{PRESS_CONTACT_EMAIL}</a>. Corrections to published figures are listed, dated, on <Link href="/press" className={LINK}>the press page</Link>.</p>
          </section>

          <nav aria-label="Other releases" className="mt-10 flex flex-wrap justify-between gap-3 text-sm">
            {older ? <Link href={`/press/layoffs/${older.slug}`} className={LINK}>← {older.label}</Link> : <span />}
            <Link href="/press/layoffs" className={LINK}>All releases</Link>
            {newer ? <Link href={`/press/layoffs/${newer.slug}`} className={LINK}>{newer.label} →</Link> : <span />}
          </nav>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
