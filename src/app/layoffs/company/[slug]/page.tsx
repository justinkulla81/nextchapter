import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { BoardList, NoticeTable } from '@/components/layoffs/NoticeTable'
import { canonical } from '@/lib/seo/canonical'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { TWENTY_FOUR_MONTHS_MS, getCompanies, getNewsMentions, noticeDay } from '@/lib/warn/layoff-pages'

// Pages are built on first visit and refreshed daily; there are over a
// thousand employers, too many to prerender on every deploy.
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  return (await getCompanies()).get(slug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = await load(slug)
  if (!c) return {}
  const workers = c.notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  const description = `${c.notices.length} WARN layoff ${c.notices.length === 1 ? 'notice' : 'notices'} filed by ${c.name} in ${c.states.map(stateName).join(', ')}${workers ? `, naming ${workers.toLocaleString()} workers` : ''}. Latest filed ${noticeDay(c.latest)}. Dates, locations and the state record for each.`
  // A page whose newest notice is over two years old stays reachable but
  // out of search results: it no longer helps anyone affected now.
  const stale = Date.now() - c.latest.getTime() > TWENTY_FOUR_MONTHS_MS
  return {
    title: `${c.name} layoffs: WARN notices and dates`,
    description,
    ...canonical(`/layoffs/company/${slug}`),
    ...(stale ? { robots: { index: false, follow: true } } : {}),
  }
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

export default async function CompanyLayoffsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await load(slug)
  if (!c) notFound()
  const mentions = await getNewsMentions(c)
  const workers = c.notices.reduce((s, n) => s + (n.workers ?? 0), 0)
  const unknownCounts = c.notices.some((n) => n.workers == null)

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: c.name, path: `/layoffs/company/${slug}` }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link>
            <span aria-hidden> › </span>
            <span className="text-foreground">{c.name}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{c.name} layoffs: WARN notices and dates</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {c.name} has filed {c.notices.length.toLocaleString()} WARN {c.notices.length === 1 ? 'notice' : 'notices'} with{' '}
            {c.states.length === 1 ? `the ${stateName(c.states[0])} labor department` : `labor departments in ${c.states.length} states`}
            {workers > 0 && <>, naming {workers.toLocaleString()} workers{unknownCounts ? ' where a count was given' : ''}</>}. The most
            recent was filed {noticeDay(c.latest)}.
          </p>

          <section aria-labelledby="notices" className="mt-10">
            <h2 id="notices" className={H2}>Notices</h2>
            <div className="mt-4">
              <NoticeTable notices={c.notices} caption={`WARN notices filed by ${c.name}, newest first`} showState={c.states.length > 1} page="company" />
            </div>
          </section>

          {mentions.length > 0 && (
            <section aria-labelledby="news" className="mt-12">
              <h2 id="news" className={H2}>In the news</h2>
              <ul className="mt-4 space-y-3">
                {mentions.map((m) => (
                  <li key={m.id} className="text-sm">
                    <TrackedLink href={m.url} event="layoff_news_clicked" properties={{ mentionId: m.id, company: slug }} className="font-medium text-navy hover:text-brand hover:underline">
                      {m.headline}
                    </TrackedLink>
                    <span className="text-muted-foreground">
                      {m.publisher && ` · ${m.publisher}`}
                      {m.publishedAt && ` · ${noticeDay(m.publishedAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="boards" className="mt-12">
            <h2 id="boards" className={H2}>Local workforce boards</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              The public workforce boards for each location in these notices. Their American Job Centers offer free help with
              job search, training and filing for benefits, and some run rapid-response services for workers in a WARN layoff.
            </p>
            <div className="mt-4"><BoardList notices={c.notices} page="company" /></div>
          </section>

          <section aria-labelledby="affected" className="mt-12 rounded-xl border border-border bg-white p-6">
            <h2 id="affected" className="text-xl font-semibold tracking-tight text-navy">What to do if you’re affected</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/start/laid-off" className={LINK}>Start here: a plan for the weeks after a layoff</Link></li>
              {c.states.map((s) => (
                <li key={s}>
                  <Link href={`/unemployment-benefits/${stateSlug(s)}`} className={LINK}>{stateName(s)} unemployment benefits and how to file</Link>
                </li>
              ))}
              <li><Link href="/resources/72-hours" className={LINK}>The first 72 hours after a layoff</Link></li>
              <li><Link href="/resources/cobra-aca" className={LINK}>COBRA and marketplace health coverage</Link></li>
              <li><Link href="/resources/bridge-income" className={LINK}>Bridge income while you search</Link></li>
            </ul>
          </section>

          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
            These are the notices {c.name} filed under the WARN Act, as published by each state. A notice gives the number of
            workers and dates the employer reported; it does not say why. See the{' '}
            <Link href="/layoffs" className={LINK}>layoff tracker</Link> for how notices are collected and what they cover.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
