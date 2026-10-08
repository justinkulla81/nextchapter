import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { BoardList, NoticeTable } from '@/components/layoffs/NoticeTable'
import { STATE_FIGURES, STATE_FIGURES_EDITION } from '@/lib/report-state-figures'
import { canonical } from '@/lib/seo/canonical'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getPublicNotices, noticeDay } from '@/lib/warn/layoff-pages'

export const revalidate = 86400

// Rendered on first visit, then refreshed daily, so a database blip during a
// deploy can't fail the build.
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const code = stateFromSlug(slug)
  if (!code) return null
  const all = (await getPublicNotices()).filter((n) => n.state === code)
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const recent = all.filter((n) => n.noticeDate.getTime() >= cutoff)
  if (recent.length === 0) return null
  return { code, name: stateName(code), all, recent }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return {}
  const workers = d.recent.reduce((s, n) => s + (n.workers ?? 0), 0)
  const description = `${d.recent.length} WARN layoff notices filed in ${d.name} in the last 12 months, naming ${workers.toLocaleString()} workers: dates, employers, locations and the state record for each, plus local job centers.`
  return {
    title: `${d.name} layoffs: WARN notices`,
    description,
    ...canonical(`/layoffs/${state}`),
  }
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

export default async function StateLayoffsPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()

  const workers = d.recent.reduce((s, n) => s + (n.workers ?? 0), 0)
  const figures = STATE_FIGURES[d.code]
  const earliest = d.all[d.all.length - 1].noticeDate
  const latest = d.all[0].noticeDate
  const sources = [...new Set(d.all.map((n) => n.sourceUrl).filter((u): u is string => !!u).map((u) => new URL(u).origin + new URL(u).pathname))]

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: d.name, path: `/layoffs/${state}` }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link>
            <span aria-hidden> › </span>
            <span className="text-foreground">{d.name}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{d.name} layoffs: WARN notices</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Employers filed {d.recent.length.toLocaleString()} layoff notices in {d.name} in the last 12 months, naming{' '}
            {workers.toLocaleString()} workers. The most recent was filed {noticeDay(latest)}.
          </p>

          <section aria-labelledby="economy" className="mt-10">
            <h2 id="economy" className={H2}>{d.name} jobs picture</h2>
            {figures ? (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {figures.unemploymentRate != null && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">{figures.unemploymentRate.toFixed(1)}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">unemployment rate, {STATE_FIGURES_EDITION.month}</p>
                  </li>
                )}
                {figures.payrollChange && (
                  <li className="rounded-xl border border-border bg-white p-5">
                    <p className="text-2xl font-bold tabular-nums text-navy">
                      {figures.payrollChange.jobs >= 0 ? '+' : '−'}{Math.abs(figures.payrollChange.jobs).toLocaleString()} jobs
                      <span className="ml-2 text-base font-medium text-muted-foreground">
                        ({figures.payrollChange.pct >= 0 ? '+' : '−'}{Math.abs(figures.payrollChange.pct).toFixed(1)}%)
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      payroll change, {STATE_FIGURES_EDITION.period}{figures.payrollChange.significant ? ' (statistically significant)' : ''}
                    </p>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                The latest Displacement Report names only the states with the largest and smallest changes, and {d.name} is
                not among them this month. See {d.name}’s figures at the{' '}
                <a href={STATE_FIGURES_EDITION.blsUrl} className={LINK} target="_blank" rel="noopener noreferrer">Bureau of Labor Statistics</a>.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Source: {STATE_FIGURES_EDITION.source}, via the{' '}
              <Link href={`/reports/${STATE_FIGURES_EDITION.slug}`} className="underline underline-offset-2">NextChapter Displacement Report</Link>. Seasonally adjusted.
            </p>
          </section>

          <section aria-labelledby="notices" className="mt-12">
            <h2 id="notices" className={H2}>Notices in the last 12 months</h2>
            <div className="mt-4">
              <NoticeTable notices={d.recent} caption={`WARN notices filed in ${d.name}, newest first`} linkEmployer page="state" />
            </div>
          </section>

          <section aria-labelledby="boards" className="mt-12">
            <h2 id="boards" className={H2}>Local workforce boards</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The public workforce boards serving the areas in these notices. Their American Job Centers offer free help with
              job search, training and filing for benefits.
            </p>
            <div className="mt-4"><BoardList notices={d.recent} page="state" /></div>
          </section>

          <section aria-labelledby="help" className="mt-12 rounded-xl border border-border bg-white p-6">
            <h2 id="help" className="text-xl font-semibold tracking-tight text-navy">If you were laid off in {d.name}</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href={`/unemployment-benefits/${state}`} className={LINK}>{d.name} unemployment benefits: amounts, weeks and how to file</Link></li>
              <li><Link href="/start/laid-off" className={LINK}>What to do after a layoff</Link></li>
              <li><Link href="/resources/cobra-aca" className={LINK}>Keeping your health coverage: COBRA and the marketplace</Link></li>
            </ul>
          </section>

          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Coverage:</span> {d.all.length.toLocaleString()} {d.name} notices on file,
            filed {noticeDay(earliest)} to {noticeDay(latest)}, collected daily from the state’s published WARN record
            {sources.length > 0 && <> ({sources.slice(0, 2).map((u, i) => <span key={u}>{i > 0 && ', '}<a href={u} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">{new URL(u).hostname}</a></span>)})</>}.
            A state may publish late or leave out worker counts, so this is a floor rather than a count of every layoff. The
            WARN Act generally applies to employers with 100 or more workers. See the{' '}
            <Link href="/layoffs" className={LINK}>national tracker</Link> for how we collect notices.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
