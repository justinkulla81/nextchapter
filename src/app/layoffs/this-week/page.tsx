import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { SITE_URL } from '@/lib/seo/facts'
import { breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { getPublicNotices, noticeDay } from '@/lib/warn/layoff-pages'

export const revalidate = 3600

const WEEK = 7 * 86_400_000
/** Under this many notices the week is too quiet to be a page of its own: it stays visible but is not offered to search engines. */
const MIN_NOTICES = 3

export async function generateMetadata(): Promise<Metadata> {
  const base = pageMetadata('/layoffs/this-week')
  const n = await weekNotices()
  return { ...base, robots: { index: n.thisWeek.length >= MIN_NOTICES, follow: true }, alternates: { ...base.alternates, types: { 'application/rss+xml': '/feeds/layoffs' } } }
}

async function weekNotices() {
  const all = await getPublicNotices().catch(() => [])
  const now = Date.now()
  const inWindow = (from: number, to: number) => all.filter((n) => now - n.noticeDate.getTime() >= from && now - n.noticeDate.getTime() < to)
  return { thisWeek: inWindow(0, WEEK), lastWeek: inWindow(WEEK, 2 * WEEK) }
}

const LINK = 'text-brand underline underline-offset-4'
const sum = (rows: { workers: number | null }[]) => rows.reduce((s, n) => s + (n.workers ?? 0), 0)

export default async function LayoffsThisWeek() {
  const { thisWeek, lastWeek } = await weekNotices()
  const workers = sum(thisWeek)
  const lastWorkers = sum(lastWeek)
  const byState = new Map<string, { n: number; w: number }>()
  for (const n of thisWeek) {
    const e = byState.get(n.state) ?? { n: 0, w: 0 }
    e.n++
    e.w += n.workers ?? 0
    byState.set(n.state, e)
  }
  const states = [...byState].sort((a, b) => b[1].w - a[1].w || b[1].n - a[1].n)
  const biggest = [...thisWeek].filter((n) => n.workers).sort((a, b) => b.workers! - a.workers!).slice(0, 8)
  const today = new Date().toISOString().slice(0, 10)
  const headline = pageH1('/layoffs/this-week', 'Layoffs this week: new WARN notices')
  const diff = thisWeek.length - lastWeek.length
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Layoffs this week: ${thisWeek.length} WARN notices${workers ? `, ${workers.toLocaleString('en-US')} workers` : ''}`,
    datePublished: today,
    dateModified: today,
    author: organizationRef(),
    publisher: organizationRef(),
    mainEntityOfPage: `${SITE_URL}/layoffs/this-week`,
  }
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={ld} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: 'This week', path: '/layoffs/this-week' }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link><span aria-hidden> › </span><span className="text-foreground">This week</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{headline}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {thisWeek.length === 0
              ? 'No new WARN notices were filed in the last seven days.'
              : `Employers filed ${thisWeek.length.toLocaleString('en-US')} layoff notices in the last seven days${workers ? `, naming ${workers.toLocaleString('en-US')} workers` : ''}, across ${states.length} ${states.length === 1 ? 'state' : 'states'}. The week before had ${lastWeek.length.toLocaleString('en-US')}${lastWorkers ? ` naming ${lastWorkers.toLocaleString('en-US')} workers` : ''}${diff !== 0 ? `, so notices are ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff).toLocaleString('en-US')}` : ''}.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Counted by the date on each filing. A state may publish a notice days after it was filed, so recent weeks can grow.</p>

          {states.length > 0 && (
            <section aria-labelledby="states" className="mt-10">
              <h2 id="states" className="text-2xl font-bold tracking-tight text-navy">By state</h2>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {states.slice(0, 12).map(([s, v]) => (
                  <li key={s}>
                    <Link href={`/layoffs/${stateSlug(s)}`} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-brand">
                      <span className="font-medium text-navy">{stateName(s)}</span>
                      <span className="tabular-nums text-muted-foreground">{v.n} {v.n === 1 ? 'notice' : 'notices'}{v.w ? ` · ${v.w.toLocaleString('en-US')} workers` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {biggest.length > 0 && (
            <section aria-labelledby="biggest" className="mt-10">
              <h2 id="biggest" className="text-2xl font-bold tracking-tight text-navy">Largest notices</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
                {biggest.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                    <TrackedLink href={`/layoffs/company/${n.slug}`} event="topic_layoff_clicked" properties={{ source: 'this-week', slug: n.slug }} className="font-medium text-navy hover:underline">{n.employer}</TrackedLink>
                    <span className="tabular-nums text-muted-foreground">{n.workers!.toLocaleString('en-US')} workers · {stateName(n.state)}{n.place ? `, ${n.place}` : ''} · {noticeDay(n.noticeDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {thisWeek.length > 0 && (
            <section aria-labelledby="all" className="mt-10">
              <h2 id="all" className="text-2xl font-bold tracking-tight text-navy">Every notice filed this week</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
                {thisWeek.slice(0, 80).map((n) => (
                  <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/layoffs/company/${n.slug}`} className="text-navy hover:underline">{n.employer}</Link>
                    <span className="tabular-nums text-muted-foreground">{n.workers ? `${n.workers.toLocaleString('en-US')} workers · ` : ''}{n.state} · {noticeDay(n.noticeDate)}</span>
                  </li>
                ))}
              </ul>
              {thisWeek.length > 80 && <p className="mt-3 text-sm text-muted-foreground">Showing 80 of {thisWeek.length.toLocaleString('en-US')}. The full list is in the <Link href="/data" className={LINK}>downloadable data</Link>.</p>}
            </section>
          )}

          <section aria-labelledby="more" className="mt-10 rounded-xl border border-border bg-white p-6">
            <h2 id="more" className="text-xl font-semibold tracking-tight text-navy">Use this data</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/data" className={LINK}>Download the WARN record as CSV or JSON</Link>, free to reuse with a link back.</li>
              <li><Link href="/feeds/layoffs" className={LINK}>Subscribe by RSS</Link> to new notices.</li>
              <li><Link href="/data/embed" className={LINK}>Embed layoff notices</Link> for any state on your own site.</li>
              <li><Link href="/layoffs" className={LINK}>The full layoff tracker</Link>, and <Link href="/start/laid-off" className={LINK}>what to do if you were laid off</Link>.</li>
            </ul>
          </section>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
