import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { CiteThisData } from '@/components/layoffs/CiteThisData'
import { MonthBars } from '@/components/layoffs/MonthBars'
import { CopyEmbed } from '@/components/data/CopyEmbed'
import { LAYOFF_YEAR, getMonths, getYearNotices } from '@/lib/layoffs/monthly'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/lib/seo/facts'
import { stateFromSlug, stateName } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { hasLayoffStatePage } from '@/lib/warn/layoff-pages'
import { Squiggle } from '@/components/ui/squiggle'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'
const n = (v: number) => v.toLocaleString('en-US')

// The page a reporter or blogger lands on for one state (or `us`): the live layoffs-by-month chart, the two embed snippets
// (chart and notice list) with the link-back line, and the citation. The widgets themselves are /embed/layoff-chart/[state] and
// /embed/layoffs/[state]; /data/embed is the builder for every widget. Indexed only for a state with notices in the last 12 months.
async function load(slug: string) {
  const code = slug === 'us' ? null : stateFromSlug(slug)
  if (slug !== 'us' && !code) return null
  if (code && !(await hasLayoffStatePage(code))) return null
  const notices = (await getYearNotices()).filter((x) => !code || x.state === code)
  if (!notices.length) return null
  const months = await getMonths(notices)
  const workers = notices.reduce((s, x) => s + (x.workers ?? 0), 0)
  return { code, where: code ? stateName(code) : 'United States', notices, months, workers }
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const d = await load(state)
  if (!d) return { title: 'Layoff data not found', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.where} Layoffs by Month, ${LAYOFF_YEAR}: Chart and Embed Code`),
    description: `${n(d.notices.length)} layoff notices in ${d.where} so far in ${LAYOFF_YEAR}${d.workers ? `, naming ${n(d.workers)} workers` : ''}. A live chart you can embed on your site for free, the copy-paste code, and how to cite the data.`,
    alternates: { canonical: `/data/layoffs/${state}` },
  }
}

const snippet = (widget: 'layoff-chart' | 'layoffs', slug: string, height: number, text: string, page: string) =>
  `<iframe src="${SITE_URL}/embed/${widget}/${slug}" width="100%" height="${height}" style="border:0;max-width:560px" loading="lazy" title="${text}"></iframe>\n<p><a href="${SITE_URL}${page}">${text}</a>, from NextChapter</p>`

export default async function LayoffDataPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const d = await load(state)
  if (!d) notFound()
  const { code, where, notices, months, workers } = d
  const chartTitle = `${where} layoffs by month, ${LAYOFF_YEAR}`
  const trackerPath = code ? `/layoffs/${state}` : '/layoffs/2026'
  const asOf = new Date().toISOString().slice(0, 10)
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Data', path: '/data' }, { name: `${where} layoff data`, path: `/data/layoffs/${state}` }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-8">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{where} layoffs by month, {LAYOFF_YEAR}</h1>
          <Squiggle className="mt-2" />
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {n(notices.length)} layoff notices so far in {LAYOFF_YEAR}{workers ? `, naming ${n(workers)} workers` : ''}, from {code ? `the ${where} labor department` : 'state labor departments'}. The chart below is free to put on your own site and stays current on its own.
          </p>

          <section className="mt-8 rounded-xl border border-border bg-white p-6">
            <h2 className={H2}>The chart</h2>
            <div className="mt-4 max-w-[560px]">
              <MonthBars months={months} label={chartTitle} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Workers named in notices, by notice date. The latest month is partial. Full list: <Link href={trackerPath} className={LINK}>{code ? `${where} layoff notices` : `layoffs ${LAYOFF_YEAR}`}</Link>.</p>
          </section>

          <section className="mt-8 rounded-xl border border-border bg-white p-6">
            <h2 className={H2}>Put it on your site</h2>
            <p className="mt-2 text-sm text-muted-foreground">Copy the code into your page. The data updates without you touching it. Keep the link under the frame; it is how readers reach the full record.</p>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-navy">Layoffs by month</p>
                <CopyEmbed widget="layoff-chart" target={state} snippet={snippet('layoff-chart', state, 360, `${where} layoffs by month`, trackerPath)} />
              </div>
              {code && (
                <div>
                  <p className="text-sm font-medium text-navy">Latest notices</p>
                  <CopyEmbed widget="layoffs" target={state} snippet={snippet('layoffs', state, 420, `${where} layoffs: layoff notices`, trackerPath)} />
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Other states, open jobs, unemployment benefits or AI exposure for a job: <Link href="/data/embed" className={LINK}>every embeddable widget</Link>.</p>
          </section>

          <CiteThisData path={`/data/layoffs/${state}`} asOf={asOf} source="data_state_page" />
        </div>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}
