import { xmlEscape, type FeedDoc, type FeedItem } from '@/lib/feeds/rss'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName, stateSlug } from '@/lib/seo/states'
import { topicSlug } from '@/lib/seo/topics'
import { getRecentNotices } from '@/lib/seo/topic-data'
import { TWELVE_MONTHS_MS, getPublicNotices, noticeDay, type PublicNotice } from '@/lib/warn/layoff-pages'
import { getWeeks, getWeekNotices } from '@/lib/layoffs/weekly'
import { weekLabel } from '@/lib/layoffs/weeks'
import { getAnnouncements, hasRecentAnnouncement, type CompanyAnnouncements } from '@/lib/warn/company-announcements'

/** Notices with this many workers or more go in the "large layoffs" feed. */
export const LARGE_NOTICE_WORKERS = 100

const num = (n: number) => n.toLocaleString('en-US')
const ordinal = (n: number) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n - 1] ?? `#${n}`

/** Item links carry a source tag so analytics shows which feed brought a visit. */
export const feedLink = (path: string, campaign: string) => `${SITE_URL}${path}${path.includes('?') ? '&' : '?'}utm_source=rss&utm_medium=feed&utm_campaign=${campaign}`

export interface LayoffFeedOpts {
  state?: string | null
  minWorkers?: number
  /** Industry bucket name (see topics.ts). */
  bucket?: string
  title: string
  description: string
  selfPath: string
  pagePath: string
  campaign: string
}

/**
 * Context for one notice, from the filing and our own counts only: where it ranks among the state's notices of the
 * last 12 months, how many this employer filed, when it takes effect. Nothing about why the employer cut jobs.
 */
export function noticeContext(n: PublicNotice, all: PublicNotice[]): { facts: string[]; employerCount: number } {
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const recent = all.filter((x) => x.noticeDate.getTime() >= cutoff)
  const facts: string[] = []
  const name = stateName(n.state)
  if (n.workers) {
    const inState = recent.filter((x) => x.state === n.state && x.workers)
    const rank = inState.filter((x) => (x.workers ?? 0) > n.workers!).length + 1
    if (rank === 1 && inState.length >= 10) facts.push(`The largest ${name} notice in the last 12 months (of ${num(inState.length)} that name a worker count).`)
    else if (rank <= 10 && inState.length >= 20) facts.push(`The ${rank}${rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} largest of ${num(inState.length)} ${name} notices naming workers in the last 12 months.`)
  }
  const sameEmployer = recent.filter((x) => x.slug === n.slug).sort((a, b) => a.noticeDate.getTime() - b.noticeDate.getTime())
  const idx = sameEmployer.findIndex((x) => x.id === n.id)
  if (sameEmployer.length > 1 && idx >= 0) {
    const total = sameEmployer.reduce((s, x) => s + (x.workers ?? 0), 0)
    facts.push(`The ${ordinal(idx + 1)} of ${sameEmployer.length} notices from this employer in the last 12 months${total ? `, together naming ${num(total)} workers` : ''}.`)
  }
  if (n.effectiveDate) facts.push(`Layoffs take effect ${noticeDay(n.effectiveDate)}.`)
  return { facts, employerCount: sameEmployer.length }
}

/** New layoff notices as a feed, newest collected first. */
export async function layoffFeed(o: LayoffFeedOpts): Promise<FeedDoc> {
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const all = await getPublicNotices()
  const bucketById = new Map((await getRecentNotices().catch(() => [])).map((t) => [t.id, t.bucket]))
  const rows = all
    .filter((n) => n.noticeDate.getTime() >= cutoff)
    .filter((n) => !o.state || n.state === o.state)
    .filter((n) => !o.minWorkers || (n.workers ?? 0) >= o.minWorkers)
    .filter((n) => !o.bucket || bucketById.get(n.id) === o.bucket)
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())
    .slice(0, 100)
  const items: FeedItem[] = rows.map((n) => {
    const sName = stateName(n.state)
    const { facts } = noticeContext(n, all)
    const bucket = bucketById.get(n.id) ?? null
    const lead = `${n.employer} filed a WARN layoff notice${n.place ? ` for ${n.place}, ${sName}` : ` in ${sName}`}${n.workers ? `, naming ${num(n.workers)} workers` : ''}${n.noticeDateKnown ? ` on ${noticeDay(n.noticeDate)}` : ` (layoffs effective ${n.effectiveDate ? noticeDay(n.effectiveDate) : 'date not given'})`}${n.type ? ` (${n.type})` : ''}.`
    const help = `If you are affected: ${sName} unemployment benefits ${SITE_URL}/unemployment-benefits/${stateSlug(n.state)}${n.board ? `; local help from ${n.board.name}` : ''}.`
    const record = n.sourceUrl ? `State record: ${n.sourceUrl}` : ''
    const description = [lead, ...facts, help, record].filter(Boolean).join(' ')
    const html = `<p>${xmlEscape(lead)}</p>${facts.length ? `<ul>${facts.map((f) => `<li>${xmlEscape(f)}</li>`).join('')}</ul>` : ''}<p>If you are affected: <a href="${xmlEscape(feedLink(`/unemployment-benefits/${stateSlug(n.state)}`, o.campaign))}">${xmlEscape(sName)} unemployment benefits</a>${n.board ? `; local help from ${n.board.website ? `<a href="${xmlEscape(n.board.website)}">${xmlEscape(n.board.name)}</a>` : xmlEscape(n.board.name)}` : ''}.</p><p>${n.sourceUrl ? `<a href="${xmlEscape(n.sourceUrl)}">State record</a> · ` : ''}<a href="${xmlEscape(feedLink(`/layoffs/company/${n.slug}`, o.campaign))}">All notices from ${xmlEscape(n.employer)}</a></p>`
    return {
      title: `${n.employer}: ${n.workers ? `${num(n.workers)} workers, ` : ''}${sName}`,
      link: feedLink(`/layoffs/company/${n.slug}`, o.campaign),
      guid: `nextchapter-warn-${n.id}`,
      date: n.fetchedAt,
      description,
      html,
      categories: [sName, ...(bucket ? [bucket] : [])],
      image: `${SITE_URL}/layoffs/${stateSlug(n.state)}/opengraph-image`,
    }
  })
  // The all-states feed also carries the employer announcements and press-reported cuts (Microsoft, TikTok and the like) that
  // an admin has chosen to publish in CRM > WARN (rssPublishedAt). Nothing is added automatically. Filtered feeds (a state,
  // large notices, an industry) are about filings, so they stay WARN-only.
  if (!o.state && !o.minWorkers && !o.bucket) {
    const announcements = await getAnnouncements().catch(() => new Map<string, CompanyAnnouncements>())
    for (const a of announcements.values()) {
      if (!hasRecentAnnouncement(a)) continue
      for (const it of a.items.filter((x) => x.rssPublishedAt && x.date.getTime() >= cutoff)) {
        const lead = `${a.name}: ${it.summary} (${noticeDay(it.date)}). This is an announcement or press report, not a WARN filing.`
        items.push({
          title: `${a.name}: ${it.summary}`,
          link: feedLink(`/layoffs/company/${a.slug}`, o.campaign),
          guid: `nextchapter-announcement-${it.id}`,
          date: it.rssPublishedAt!,
          description: [lead, it.sourceUrl ? `Source: ${it.sourceUrl}` : ''].filter(Boolean).join(' '),
          html: `<p>${xmlEscape(lead)}</p><p>${it.sourceUrl ? `<a href="${xmlEscape(it.sourceUrl)}">Source</a> · ` : ''}<a href="${xmlEscape(feedLink(`/layoffs/company/${a.slug}`, o.campaign))}">${xmlEscape(a.name)} layoff page</a></p>`,
          categories: ['Announcement'],
        })
      }
    }
    items.sort((x, y) => y.date.getTime() - x.date.getTime())
    items.length = Math.min(items.length, 100)
  }
  return { title: o.title, description: o.description, path: o.pagePath, selfPath: o.selfPath, items, hub: true }
}

export const allLayoffFeed = () => layoffFeed({
  title: 'Layoff notices (WARN) from NextChapter',
  description: 'New WARN Act layoff notices from every state labor department we collect, each with the state record, how it compares, and help for affected workers.',
  selfPath: '/feeds/layoffs', pagePath: '/layoffs', campaign: 'layoffs-all',
})

export const largeLayoffFeed = () => layoffFeed({
  minWorkers: LARGE_NOTICE_WORKERS,
  title: `Large layoffs: ${LARGE_NOTICE_WORKERS}+ workers (WARN) from NextChapter`,
  description: `Only WARN notices naming ${LARGE_NOTICE_WORKERS} or more workers, in any state. Each with the state record.`,
  selfPath: '/feeds/layoffs-100plus.xml', pagePath: '/layoffs', campaign: 'layoffs-100plus',
})

export const stateLayoffFeed = (code: string, slug: string) => layoffFeed({
  state: code,
  title: `${stateName(code)} layoff notices (WARN)`,
  description: `New WARN Act layoff notices in ${stateName(code)}, collected from the state labor department, each with the state record and help for affected workers.`,
  selfPath: `/feeds/layoffs/${slug}`, pagePath: `/layoffs/${slug}`, campaign: `layoffs-${slug}`,
})

export const industryLayoffFeed = (bucket: string) => {
  const slug = topicSlug(bucket)
  return layoffFeed({
    bucket,
    title: `${bucket} layoff notices (WARN)`,
    description: `New WARN Act layoff notices from ${bucket} employers, in every state, each with the state record.`,
    selfPath: `/feeds/industries/${slug}`, pagePath: `/industries/${slug}`, campaign: `industry-${slug}`,
  })
}

/** One item per complete week: the totals, the biggest notices, and the week's page. */
export async function weeklyLayoffFeed(): Promise<FeedDoc> {
  const weeks = (await getWeeks()).slice(0, 12)
  const items: FeedItem[] = []
  for (const w of weeks) {
    const data = await getWeekNotices(w.id)
    if (!data) continue
    const top = [...data.notices].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0)).filter((n) => n.workers).slice(0, 5)
    const states = new Set(data.notices.map((n) => n.state)).size
    const label = weekLabel(w.monday)
    const lead = `${num(w.count)} WARN layoff notice${w.count === 1 ? '' : 's'} in ${states} state${states === 1 ? '' : 's'}${w.workers ? `, naming ${num(w.workers)} workers` : ''}, filed in the week of ${label}.`
    const biggest = top.length ? `Largest: ${top.map((n) => `${n.employer} (${stateName(n.state)}, ${num(n.workers!)})`).join('; ')}.` : ''
    items.push({
      title: `Layoffs, week of ${label}: ${num(w.count)} notices${w.workers ? `, ${num(w.workers)} workers` : ''}`,
      link: feedLink(`/layoffs/week/${w.id}`, 'layoffs-weekly'),
      guid: `nextchapter-warn-week-${w.id}-${w.count}`,
      date: new Date(w.monday.getTime() + 7 * 86_400_000),
      description: `${lead} ${biggest}`.trim(),
      html: `<p>${xmlEscape(lead)}</p>${top.length ? `<ol>${top.map((n) => `<li>${xmlEscape(n.employer)}, ${xmlEscape(stateName(n.state))}: ${num(n.workers!)} workers</li>`).join('')}</ol>` : ''}`,
      categories: ['Weekly summary'],
    })
  }
  return {
    title: 'Weekly layoff summary (WARN) from NextChapter',
    description: 'One item a week: how many WARN layoff notices were filed, how many workers they name, and the largest, with every notice on the week\'s page.',
    path: '/layoffs/week', selfPath: '/feeds/layoffs-weekly.xml', items, hub: true,
  }
}

/** One item per day for the last two weeks: WARN notices dated that day, the workers they name and the largest. Today is left out until it is over. */
export async function dailyLayoffFeed(): Promise<FeedDoc> {
  const all = (await getPublicNotices()).filter((n) => n.noticeDateKnown)
  const startOfToday = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const items: FeedItem[] = []
  for (let i = 1; i <= 14; i++) {
    const start = startOfToday - i * 86_400_000
    const day = new Date(start)
    const notices = all.filter((n) => n.noticeDate.getTime() >= start && n.noticeDate.getTime() < start + 86_400_000)
    if (notices.length === 0) continue
    const workers = notices.reduce((s, n) => s + (n.workers ?? 0), 0)
    const states = new Set(notices.map((n) => n.state)).size
    const top = [...notices].filter((n) => n.workers).sort((a, b) => b.workers! - a.workers!).slice(0, 5)
    const label = noticeDay(day)
    const lead = `${num(notices.length)} WARN layoff notice${notices.length === 1 ? '' : 's'} dated ${label}, in ${states} state${states === 1 ? '' : 's'}${workers ? `, naming ${num(workers)} workers` : ''}.`
    const biggest = top.length ? `Largest: ${top.map((n) => `${n.employer} (${stateName(n.state)}, ${num(n.workers!)})`).join('; ')}.` : ''
    items.push({
      title: `Layoffs on ${label}: ${num(notices.length)} notices${workers ? `, ${num(workers)} workers` : ''}`,
      link: feedLink('/layoffs/this-week', 'layoffs-daily'),
      guid: `nextchapter-warn-day-${day.toISOString().slice(0, 10)}-${notices.length}`,
      date: new Date(start + 86_400_000),
      description: `${lead} ${biggest}`.trim(),
      html: `<p>${xmlEscape(lead)}</p>${top.length ? `<ol>${top.map((n) => `<li>${xmlEscape(n.employer)}, ${xmlEscape(stateName(n.state))}: ${num(n.workers!)} workers</li>`).join('')}</ol>` : ''}<p>Counted by the date on each filing; a state can publish a notice later, so a day's count can grow. Free to quote with a link to ${SITE_URL}/layoffs/2026.</p>`,
      categories: ['Daily summary'],
    })
  }
  return {
    title: 'Daily layoff numbers (WARN) from NextChapter',
    description: 'One item a day: how many WARN layoff notices were dated that day, how many workers they name, and the largest. Free to quote with a link back.',
    path: '/layoffs/this-week', selfPath: '/feeds/layoffs-daily.xml', items, hub: true,
  }
}
