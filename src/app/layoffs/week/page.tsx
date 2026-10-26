import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { weekLabel } from '@/lib/layoffs/weeks'
import { getWeeks } from '@/lib/layoffs/weekly'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

export const revalidate = 3600
export const metadata: Metadata = pageMetadata('/layoffs/week')

const LINK = 'text-brand underline underline-offset-4'

export default async function WeeklyLayoffsIndex() {
  const weeks = await getWeeks()
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: 'Weekly layoffs', path: '/layoffs/week' }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1('/layoffs/week', 'Layoffs by week: WARN notices')}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Every week of WARN layoff notices from the last two years: how many, how many workers, which states and employers. This week is on <Link href="/layoffs/this-week" className={LINK}>layoffs this week</Link>.
          </p>
          <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-white">
            {weeks.map((w) => (
              <li key={w.id}>
                <Link href={`/layoffs/week/${w.id}`} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm hover:bg-off-white">
                  <span className="font-medium text-navy">Week of {weekLabel(w.monday)}</span>
                  <span className="tabular-nums text-muted-foreground">{w.count} {w.count === 1 ? 'notice' : 'notices'}{w.workers ? ` · ${w.workers.toLocaleString('en-US')} workers` : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">Data for every week is in the <Link href="/data" className={LINK}>downloadable record</Link>.</p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
