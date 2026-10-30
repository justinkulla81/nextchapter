import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'

export const WEEK_MS = 7 * 86_400_000
/** A quieter week than this is not worth a post. */
export const MIN_NOTICES = 10

export interface WeekNotice {
  state: string
  workers: number | null
  noticeDate: Date
}

export interface SocialPost {
  /** Stable id, so a post is never sent twice. */
  key: string
  text: string
}

const n = (v: number) => v.toLocaleString('en-US')

/** ISO week label, e.g. 2026-W44, from a UTC date. */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

/**
 * The Monday post: last seven days of WARN layoff notices as totals, never employer names (employer-specific posts go
 * through the human-approved queue). Null when the week was too quiet.
 */
export function weeklyLayoffPost(notices: WeekNotice[], now: Date, utm: string): SocialPost | null {
  const cutoff = now.getTime() - WEEK_MS
  const prevCutoff = cutoff - WEEK_MS
  const thisWeek = notices.filter((x) => x.noticeDate.getTime() > cutoff && x.noticeDate.getTime() <= now.getTime())
  const lastWeek = notices.filter((x) => x.noticeDate.getTime() > prevCutoff && x.noticeDate.getTime() <= cutoff)
  if (thisWeek.length < MIN_NOTICES) return null
  const workers = thisWeek.reduce((s, x) => s + (x.workers ?? 0), 0)
  const byState = new Map<string, number>()
  for (const x of thisWeek) byState.set(x.state, (byState.get(x.state) ?? 0) + (x.workers ?? 0))
  const top = [...byState].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, w]) => w > 0).map(([s]) => stateName(s))
  const diff = thisWeek.length - lastWeek.length
  const trend = lastWeek.length ? ` That is ${diff === 0 ? 'the same as' : `${n(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than`} the week before.` : ''
  const text =
    `Layoff notices filed in the last 7 days: ${n(thisWeek.length)} WARN notices${workers ? ` naming ${n(workers)} workers` : ''}.${trend}` +
    (top.length ? ` Most workers: ${top.join(', ')}.` : '') +
    ` Free data, every notice: ${SITE_URL}/layoffs/this-week?${utm}`
  return { key: `layoffs-week-${weekKey(now)}`, text }
}

export interface FilingForPost {
  employer: string
  state: string | null
  workers: number | null
  date: Date
  /** /layoffs/company/<slug> */
  path: string
}

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * One employer's WARN filing as a post, for an admin to send by hand (CRM > WARN > Publishing). State records only: press
 * reports and buyouts are never posted this way until a second source confirms them. Under 280 characters with the link
 * counted as 23, and no claim beyond what the filing says.
 */
export function filingPostText(f: FilingForPost, utm: string): string {
  const where = f.state ? ` in ${stateName(f.state)}` : ''
  const workers = f.workers ? `, naming ${n(f.workers)} workers` : ''
  const link = `${SITE_URL}${f.path}?${utm}`
  const tail = ` What was filed and what to do if you are affected: ${link}`
  const head = (name: string) => `${name} filed a WARN layoff notice${where} on ${day(f.date)}${workers}.`
  const budget = 280 - 23 + link.length // the link costs 23 characters on X whatever its length
  let name = f.employer
  while (name.length > 12 && (head(name) + tail).length > budget) name = name.slice(0, -2).trimEnd()
  return head(name === f.employer ? name : `${name}…`) + tail
}

/** Fewer new notices than this in a day is not worth a post. */
export const MIN_DAILY_NOTICES = 3
const DAY_MS_ = 86_400_000

export interface DayNotice {
  state: string
  workers: number | null
  /** When we collected the notice: "new today" means new to our record, since a state can publish a filing days late. */
  fetchedAt: Date
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * The daily roundup: WARN notices collected in the last 24 hours as totals, never employer names. Null on a quiet day.
 */
export function dailyLayoffPost(notices: DayNotice[], now: Date, utm: string): SocialPost | null {
  const cutoff = now.getTime() - DAY_MS_
  const today = notices.filter((x) => x.fetchedAt.getTime() > cutoff && x.fetchedAt.getTime() <= now.getTime())
  if (today.length < MIN_DAILY_NOTICES) return null
  const workers = today.reduce((s, x) => s + (x.workers ?? 0), 0)
  const states = new Set(today.map((x) => x.state)).size
  const byState = new Map<string, number>()
  for (const x of today) byState.set(x.state, (byState.get(x.state) ?? 0) + (x.workers ?? 0))
  const top = [...byState].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, w]) => w > 0).map(([s]) => stateName(s))
  const text =
    `New layoff notices in the last 24 hours: ${n(today.length)} WARN notices in ${n(states)} ${states === 1 ? 'state' : 'states'}${workers ? `, naming ${n(workers)} workers` : ''}.` +
    (top.length ? ` Most workers: ${top.join(', ')}.` : '') +
    ` Every notice, with the state record: ${SITE_URL}/layoffs/this-week?${utm}`
  return { key: `layoffs-day-${dayKey(now)}`, text }
}

/** A report edition published in the last 10 days, so turning posting on never announces an old report. */
export const REPORT_POST_WINDOW_DAYS = 10

export interface ReportForPost {
  slug: string
  month: string
  title: string
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string
}

export function reportPost(r: ReportForPost | null, now: Date, utm: string): SocialPost | null {
  if (!r) return null
  const at = new Date(`${r.publishedAt}T12:00:00Z`).getTime()
  if (at > now.getTime() || now.getTime() - at > REPORT_POST_WINDOW_DAYS * DAY_MS_) return null
  const link = `${SITE_URL}/reports/${r.slug}?${utm}`
  let title = r.title
  const build = (t: string) => `New: the NextChapter White Collar Employment Report, ${r.month}. ${t} Free to read: ${link}`
  const budget = 280 - 23 + link.length
  while (title.length > 20 && build(title).length > budget) title = title.slice(0, -2).trimEnd()
  return { key: `report-${r.slug}`, text: build(title === r.title ? `${title}.` : `${title}…`) }
}
