import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { nextWeek, parseWeekId, prevWeek, weekEnd, weekId, weekLabel } from '@/lib/layoffs/weeks'
import { WEEKS_BACK, WEEK_MIN_NOTICES, currentWeekStart, getWeekNotices } from '@/lib/layoffs/weekly'
import { SITE_URL } from '@/lib/seo/facts'
import { breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { stateName, stateSlug } from '@/lib/seo/states'
import { titleMeta } from '@/lib/seo/title'
import { noticeDay } from '@/lib/warn/layoff-pages'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

const LINK = 'text-brand underline underline-offset-4'
const sum = (rows: { workers: number | null }[]) => rows.reduce((s, n) => s + (n.workers ?? 0), 0)

async function load(week: string) {
  const monday = parseWeekId(week)
  if (!monday) return null
  const current = currentWeekStart().getTime()
  if (monday.getTime() > current) return null
  if (monday.getTime() === current) return { redirect: true as const }
  if (monday.getTime() < current - WEEKS_BACK * 7 * 86_400_000) return null
  const [this_, prev] = await Promise.all([getWeekNotices(week), getWeekNotices(weekId(prevWeek(monday)))])
  if (!this_) return null
  return { redirect: false as const, monday, notices: this_.notices, prev: prev?.notices ?? [] }
}

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const { week } = await params
  const d = await load(week)
  if (!d || d.redirect) return { title: 'Week not found', robots: { index: false, follow: true } }
  const workers = sum(d.notices)
  return {
    title: titleMeta(`Layoffs week of ${d.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}: ${d.notices.length} WARN notices`),
    description: `${d.notices.length} WARN layoff notices were filed ${weekLabel(d.monday)}${workers ? `, naming ${workers.toLocaleString('en-US')} workers` : ''}. See the states, the largest employers and the state record for each.`,
    robots: { index: d.notices.length >= WEEK_MIN_NOTICES, follow: true },
    alternates: { canonical: `/layoffs/week/${week}` },
  }
}

export default async function WeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params
  const d = await load(week)
  if (!d) notFound()
  if (d.redirect) permanentRedirect('/layoffs/this-week')
  const { monday, notices, prev } = d
  const workers = sum(notices)
  const byState = new Map<string, { n: number; w: number }>()
  for (const n of notices) {
    const e = byState.get(n.state) ?? { n: 0, w: 0 }
    e.n++
    e.w += n.workers ?? 0
    byState.set(n.state, e)
  }
  const states = [...byState].sort((a, b) => b[1].w - a[1].w || b[1].n - a[1].n)
  const biggest = notices.filter((n) => n.workers).sort((a, b) => b.workers! - a.workers!).slice(0, 8)
  const diff = notices.length - prev.length
  const label = weekLabel(monday)
  const published = new Date(weekEnd(monday).getTime() + 86_400_000).toISOString().slice(0, 10)
  const modified = notices.reduce((m, n) => (n.fetchedAt > m ? n.fetchedAt : m), weekEnd(monday)).toISOString().slice(0, 10)
  const nextMonday = nextWeek(monday)
  const hasNext = nextMonday.getTime() < currentWeekStart().getTime()
  const trail = [{ name: 'Layoff tracker', path: '/layoffs' }, { name: 'Weekly layoffs', path: '/layoffs/week' }, { name: label, path: `/layoffs/week/${week}` }]
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'Article', headline: `Layoffs, ${label}: ${notices.length} WARN notices`, datePublished: published, dateModified: modified, author: organizationRef(), publisher: organizationRef(), mainEntityOfPage: `${SITE_URL}/layoffs/week/${week}` }} />
      <StructuredData data={breadcrumbJsonLd(trail)} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link><span aria-hidden> › </span>
            <Link href="/layoffs/week" className="hover:text-foreground">Weekly layoffs</Link><span aria-hidden> › </span><span className="text-foreground">{label}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Layoffs, week of {label}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            {notices.length === 0
              ? 'No WARN notices carry a filing date in that week.'
              : `Employers filed ${notices.length.toLocaleString('en-US')} WARN layoff notices dated that week${workers ? `, naming ${workers.toLocaleString('en-US')} workers` : ''}, across ${states.length} ${states.length === 1 ? 'state' : 'states'}. The week before had ${prev.length.toLocaleString('en-US')}${diff !== 0 ? `, so notices were ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff).toLocaleString('en-US')}` : ''}.`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Counted by the date on each filing; a state can publish a notice later, so a week’s count can grow.</p>

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
                    <TrackedLink href={`/layoffs/company/${n.slug}`} event="topic_layoff_clicked" properties={{ source: `week:${week}`, slug: n.slug }} className="font-medium text-navy hover:underline">{n.employer}</TrackedLink>
                    <span className="tabular-nums text-muted-foreground">{n.workers!.toLocaleString('en-US')} workers · {stateName(n.state)}{n.place ? `, ${n.place}` : ''} · {noticeDay(n.noticeDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {notices.length > 0 && (
            <section aria-labelledby="all" className="mt-10">
              <h2 id="all" className="text-2xl font-bold tracking-tight text-navy">Every notice</h2>
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
                {notices.slice(0, 80).map((n) => (
                  <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/layoffs/company/${n.slug}`} className="text-navy hover:underline">{n.employer}</Link>
                    <span className="tabular-nums text-muted-foreground">{n.workers ? `${n.workers.toLocaleString('en-US')} workers · ` : ''}{n.state} · {noticeDay(n.noticeDate)}</span>
                  </li>
                ))}
              </ul>
              {notices.length > 80 && <p className="mt-3 text-sm text-muted-foreground">Showing 80 of {notices.length.toLocaleString('en-US')}. All rows are in the <Link href="/data" className={LINK}>downloadable record</Link>.</p>}
            </section>
          )}
          <nav aria-label="Other weeks" className="mt-10 flex flex-wrap justify-between gap-3 text-sm">
            <Link href={`/layoffs/week/${weekId(prevWeek(monday))}`} className={LINK}>← Previous week</Link>
            <Link href="/layoffs/week" className={LINK}>All weeks</Link>
            {hasNext ? <Link href={`/layoffs/week/${weekId(nextMonday)}`} className={LINK}>Next week →</Link> : <Link href="/layoffs/this-week" className={LINK}>This week →</Link>}
          </nav>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" />
    </div>
  )
}
