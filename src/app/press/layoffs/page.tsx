import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { PressDownload } from '@/components/press/PressDownload'
import { StructuredData } from '@/components/StructuredData'
import { getRelease, listReleases } from '@/lib/press/layoff-release'
import { PRESS_CONTACT_EMAIL } from '@/lib/press/figures'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { Squiggle } from '@/components/ui/squiggle'

export const revalidate = 21600 // 6 hours

const PATH = '/press/layoffs'
export const metadata: Metadata = pageMetadata(PATH)

const LINK = 'text-brand underline underline-offset-4'
const n = (v: number) => v.toLocaleString('en-US')

export default async function LayoffReleasesPage() {
  const releases = await listReleases()
  const latest = releases[0] ? await getRelease(releases[0].slug) : null
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Press and data', path: '/press' }, { name: 'Layoff data for reporters', path: PATH }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-8">
        <div className="mx-auto max-w-4xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/press" className="hover:text-foreground">Press and data</Link><span aria-hidden> › </span><span className="text-foreground">Layoff data for reporters</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1(PATH, 'Layoff data for reporters')}</h1>
          <Squiggle className="mt-2" />
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Each month, a release of the U.S. layoff notices we collect from state labor departments: findings in plain sentences, comparisons with the month before and a year earlier, tables by state and employer, a CSV of every notice and the method. Free to quote and reuse with a link back.
          </p>

          {latest && (
            <section aria-labelledby="latest" className="mt-8 rounded-xl border border-border bg-white p-6">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Latest release</p>
              <h2 id="latest" className="mt-1 text-2xl font-bold tracking-tight text-navy">
                <Link href={`/press/layoffs/${latest.slug}`} className="hover:underline">{latest.label}: {n(latest.notices)} layoff notices{latest.workers ? `, ${n(latest.workers)} people named` : ''}</Link>
              </h2>
              <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-ink">
                {latest.findings.slice(1, 4).map((f) => <li key={f}>{f}</li>)}
              </ul>
              <p className="mt-4 text-sm">
                <Link href={`/press/layoffs/${latest.slug}`} className={LINK}>Read the full release</Link>
                {' · '}
                <PressDownload href={`/press/layoffs/${latest.slug}/layoffs.csv`} id={`layoff-release-hub-${latest.slug}-csv`}>Download the CSV</PressDownload>
              </p>
            </section>
          )}

          {releases.length > 0 && (
            <section aria-labelledby="all" className="mt-10">
              <h2 id="all" className="text-2xl font-bold tracking-tight text-navy">All releases</h2>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {releases.map((r) => (
                  <li key={r.slug}><Link href={`/press/layoffs/${r.slug}`} className="block rounded-lg border border-border bg-white px-4 py-2.5 font-medium text-navy hover:border-brand">{r.label}</Link></li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="always" className="mt-10">
            <h2 id="always" className="text-2xl font-bold tracking-tight text-navy">Always current</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/layoffs" className={LINK}>Layoff tracker</Link> and <Link href="/layoffs/this-week" className={LINK}>this week’s notices</Link></li>
              <li><PressDownload href="/data/layoffs.csv" id="layoff-hub-all-csv">All notices, last 24 months (CSV)</PressDownload> · <PressDownload href="/data/layoffs.json" id="layoff-hub-all-json">JSON</PressDownload></li>
              <li><Link href="/feeds" className={LINK}>RSS and JSON feeds</Link> by state, industry or size</li>
              <li><Link href="/data/embed" className={LINK}>Embeddable layoff widgets</Link></li>
            </ul>
          </section>

          <p className="mt-10 text-sm text-muted-foreground">Reporters can write to <a href={`mailto:${PRESS_CONTACT_EMAIL}`} className={LINK}>{PRESS_CONTACT_EMAIL}</a>.</p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
