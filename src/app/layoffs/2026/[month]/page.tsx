import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { CiteThisData } from '@/components/layoffs/CiteThisData'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { LAYOFF_YEAR, MONTH_MIN_NOTICES, MONTH_SLUGS, byState, getYearNotices, monthIndex, monthName, topEmployers } from '@/lib/layoffs/monthly'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { noticeDay, type PublicNotice } from '@/lib/warn/layoff-pages'

export const revalidate = 3600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'
const n = (v: number) => v.toLocaleString('en-US')

async function load(slug: string) {
  const i = monthIndex(slug)
  if (i < 0) return null
  const now = new Date()
  // A month that has not started has no page; the current one is partial.
  if (now.getUTCFullYear() < LAYOFF_YEAR || (now.getUTCFullYear() === LAYOFF_YEAR && i > now.getUTCMonth())) return null
  const all = await getYearNotices()
  const notices: PublicNotice[] = all.filter((x) => x.noticeDate.getUTCMonth() === i)
  const prev = i > 0 ? all.filter((x) => x.noticeDate.getUTCMonth() === i - 1) : []
  const partial = now.getUTCFullYear() === LAYOFF_YEAR && i === now.getUTCMonth()
  return { i, notices, prev, partial }
}

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const { month } = await params
  const d = await load(month)
  if (!d) return { title: 'Month not found', robots: { index: false, follow: true } }
  const workers = d.notices.reduce((s, x) => s + (x.workers ?? 0), 0)
  const name = monthName(d.i)
  return {
    title: titleMeta(`${name} ${LAYOFF_YEAR} Layoffs: ${n(d.notices.length)} WARN Notices${workers ? `, ${n(workers)} Workers` : ''}`),
    description: `${n(d.notices.length)} WARN layoff notices dated ${name} ${LAYOFF_YEAR}${workers ? `, naming ${n(workers)} workers` : ''}. The largest employers, the states, and the state record for each filing.`,
    robots: { index: d.notices.length >= MONTH_MIN_NOTICES, follow: true },
    alternates: { canonical: `/layoffs/2026/${month}` },
  }
}

export default async function MonthLayoffsPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  const d = await load(month)
  if (!d) notFound()
  const { i, notices, prev, partial } = d
  const name = monthName(i)
  const workers = notices.reduce((s, x) => s + (x.workers ?? 0), 0)
  const states = byState(notices)
  const employers = topEmployers(notices, 15)
  const diff = notices.length - prev.length
  const modified = notices.reduce((m, x) => (x.fetchedAt > m ? x.fetchedAt : m), new Date(Date.UTC(LAYOFF_YEAR, i, 1))).toISOString().slice(0, 10)
  const path = `/layoffs/2026/${month}`
  const prevSlug = i > 0 ? MONTH_SLUGS[i - 1] : null
  const nextSlug = i < 11 ? MONTH_SLUGS[i + 1] : null
  const now = new Date()
  const hasNext = nextSlug && !(now.getUTCFullYear() === LAYOFF_YEAR && i + 1 > now.getUTCMonth())
  const sorted = [...notices].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || b.noticeDate.getTime() - a.noticeDate.getTime())

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={articleJsonLd({ headline: `${name} ${LAYOFF_YEAR} layoffs: ${n(notices.length)} WARN notices`, path, dateModified: modified, type: 'Article' })} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: `Layoffs ${LAYOFF_YEAR}`, path: '/layoffs/2026' }, { name: name, path }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link><span aria-hidden> › </span>
            <Link href="/layoffs/2026" className="hover:text-foreground">Layoffs {LAYOFF_YEAR}</Link><span aria-hidden> › </span><span className="text-foreground">{name}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{name} {LAYOFF_YEAR} layoffs: {n(notices.length)} WARN notices</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {notices.length === 0
              ? `No WARN notices carry a filing date in ${name} ${LAYOFF_YEAR}.`
              : `Employers filed ${n(notices.length)} WARN layoff notices dated ${name} ${LAYOFF_YEAR}${workers ? `, naming ${n(workers)} workers` : ''}, across ${states.length} ${states.length === 1 ? 'state' : 'states'}.${prevSlug ? ` ${monthName(i - 1)} had ${n(prev.length)}${diff !== 0 ? `, so notices were ${diff > 0 ? 'up' : 'down'} ${n(Math.abs(diff))}` : ''}.` : ''}`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {partial ? `${name} is not over, so this count will grow. ` : ''}Counted by the date on each filing; a state can publish a notice later, so a month’s count can grow.
          </p>

          {employers.length > 0 && (
            <section aria-labelledby="employers" className="mt-10">
              <h2 id="employers" className={H2}>Largest employers in {name}</h2>
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

          {states.length > 0 && (
            <section aria-labelledby="states" className="mt-10">
              <h2 id="states" className={H2}>By state</h2>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {states.slice(0, 12).map((s) => (
                  <li key={s.state}>
                    <Link href={`/layoffs/${stateSlug(s.state)}`} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-brand">
                      <span className="font-medium text-navy">{stateName(s.state)}</span>
                      <span className="tabular-nums text-muted-foreground">{n(s.notices)} {s.notices === 1 ? 'notice' : 'notices'}{s.workers ? ` · ${n(s.workers)} workers` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sorted.length > 0 && (
            <section aria-labelledby="all" className="mt-10">
              <h2 id="all" className={H2}>Every notice, largest first</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
                {sorted.slice(0, 100).map((x) => (
                  <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/layoffs/company/${x.slug}`} className="text-navy hover:underline">{x.employer}</Link>
                    <span className="tabular-nums text-muted-foreground">{x.workers ? `${n(x.workers)} workers · ` : ''}{x.state} · {noticeDay(x.noticeDate)}</span>
                  </li>
                ))}
              </ul>
              {sorted.length > 100 && <p className="mt-3 text-sm text-muted-foreground">Showing 100 of {n(sorted.length)}. All rows are in the <Link href="/data" className={LINK}>downloadable record</Link>.</p>}
            </section>
          )}

          <CiteThisData path={path} source={`layoffs-2026-${month}`} />

          <nav aria-label="Other months" className="mt-10 flex flex-wrap justify-between gap-3 text-sm">
            {prevSlug ? <Link href={`/layoffs/2026/${prevSlug}`} className={LINK}>← {monthName(i - 1)}</Link> : <span />}
            <Link href="/layoffs/2026" className={LINK}>All of {LAYOFF_YEAR}</Link>
            {hasNext ? <Link href={`/layoffs/2026/${nextSlug}`} className={LINK}>{monthName(i + 1)} →</Link> : <Link href="/layoffs/this-week" className={LINK}>This week →</Link>}
          </nav>
          <div className="mt-10"><LayoffAlertForm source={`layoffs:2026:${month}`} /></div>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
