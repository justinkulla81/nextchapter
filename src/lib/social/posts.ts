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
 * The Monday post: last seven days of layoff notices (state WARN notices) as totals, never employer names (employer-specific posts go
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
  const trend = lastWeek.length ? ` (${diff === 0 ? 'same as' : `${n(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than`} last week)` : ''
  const text =
    `${workers ? `${n(workers)} people` : `${n(thisWeek.length)} companies`} found out this week they are losing their jobs: ${n(thisWeek.length)} layoff notices${trend}.` +
    (top.length ? ` Hit hardest: ${top.join(', ')}.` : '') +
    ` Just laid off? Start here: ${SITE_URL}/layoffs/this-week?${utm} #layoffs #laidoff #jobsearch`
  return { key: `layoffs-week-${weekKey(now)}`, text }
}

/**
 * The most characters a post may have. X counts any link as 23 characters, so its text may be 280 - 23 + the link's length.
 * Every other channel counts the whole link, and Bluesky is the tightest at 300.
 */
export function textBudget(link: string, shortLinks: boolean): number {
  return shortLinks ? 280 - 23 + link.length : 300
}

const STREET_WORDS = 'Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Parkway|Pkwy|Highway|Hwy|Court|Ct|Place|Pl|Circle|Cir|Trail|Pike|Loop'
const FILED_ADDRESS = new RegExp(`^(.+?)\\s+\\d{1,6}\\s+(?:[A-Za-z0-9.'#-]+\\s+){0,5}?(?:${STREET_WORDS})\\.?\\s+([A-Za-z .'-]+?),\\s*([A-Z]{2}),?\\s*\\d{5}(?:-\\d{4})?\\s*$`, 'i')

const titleCase = (v: string) => v.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())

/**
 * A WARN filing's employer field can carry the site's street address ("GEICO 3535 W Pipkin Road LAKELAND, FL, 33811"). A person
 * would say "Geico, Lakeland", not read out the street and zip, so this splits the name from the city. Anything that does not look
 * like name + street + city + state + zip is returned untouched.
 */
export function splitFilingEmployer(employer: string): { name: string; city: string | null } {
  const m = FILED_ADDRESS.exec(employer.trim())
  return m ? { name: m[1].trim(), city: titleCase(m[2].trim()) } : { name: employer, city: null }
}

export interface FilingForPost {
  employer: string
  state: string | null
  /** The site's city, when the filing gave one. Said as "its Lakeland, Florida site". */
  city?: string | null
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
export function filingPostText(f: FilingForPost, utm: string, shortLinks = true): string {
  const where = f.city && f.state ? ` for its ${f.city}, ${stateName(f.state)} site` : f.state ? ` in ${stateName(f.state)}` : ''
  const workers = f.workers ? `, naming ${n(f.workers)} workers` : ''
  const link = `${SITE_URL}${f.path}?${utm}`
  const tail = ` What was filed and what to do if you are affected: ${link}`
  const head = (name: string) => `${name} filed a WARN layoff notice${where} on ${day(f.date)}${workers}.`
  const budget = textBudget(link, shortLinks)
  const fit = (name: string) => head(name === f.employer ? name : `${name}…`) + tail
  let name = f.employer
  while (name.length > 12 && fit(name).length > budget) name = name.slice(0, -2).trimEnd()
  return fit(name)
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
    `${workers ? `${n(workers)} more people` : `${n(today.length)} more layoff notices`} found out they are losing their jobs in the last 24 hours, in ${n(states)} ${states === 1 ? 'state' : 'states'}.` +
    (top.length ? ` Hit hardest: ${top.join(', ')}.` : '') +
    ` Just laid off? Start here: ${SITE_URL}/layoffs/this-week?${utm} #layoffs #jobsearch`
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

export function reportPost(r: ReportForPost | null, now: Date, utm: string, shortLinks = true): SocialPost | null {
  if (!r) return null
  const at = new Date(`${r.publishedAt}T12:00:00Z`).getTime()
  if (at > now.getTime() || now.getTime() - at > REPORT_POST_WINDOW_DAYS * DAY_MS_) return null
  const link = `${SITE_URL}/reports/${r.slug}?${utm}`
  let title = r.title
  const build = (t: string) => `New: the NextChapter White Collar Employment Report, ${r.month}. ${t} Free to read: ${link}`
  const budget = textBudget(link, shortLinks)
  while (title.length > 20 && build(title).length > budget) title = title.slice(0, -2).trimEnd()
  return { key: `report-${r.slug}`, text: build(title === r.title ? `${title}.` : `${title}…`) }
}

/** A month's rankings need at least this many lists before they are announced. */
export const MIN_RANKINGS_POSTED = 50

export interface RankingForPost { slug: string; measure: string; scopeKind: string; title: string; edition: string; topName: string; topValueLabel: string; editions: string[] }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * The monthly rankings roundup: this month's edition, with the leader of three national lists (entry-level jobs, AI skills in
 * postings, pay after the cost of living). Aggregate findings only, no employer names. Null until the month has enough lists, and
 * only for the current month, so turning posting on never announces an old edition.
 */
export function rankingsPost(index: RankingForPost[], now: Date, utm: string): SocialPost | null {
  const edition = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const lists = index.filter((x) => x.editions.includes(edition))
  if (lists.length < MIN_RANKINGS_POSTED) return null
  const pick = (measure: string) => lists.find((x) => x.measure === measure && x.scopeKind === 'national' && x.edition === edition)
  const lines = [
    ['Entry-level jobs', pick('junior')],
    ['AI skills asked for', pick('ai')],
    ['Pay after cost of living', pick('paycost')],
  ].flatMap(([label, x]) => (x ? [`${label}: ${(x as RankingForPost).topName} (${(x as RankingForPost).topValueLabel})`] : []))
  const link = `${SITE_URL}/rankings/archive/${edition}?${utm}`
  const text = `NextChapter job market rankings, ${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}: ${n(lists.length)} lists.${lines.length ? ` #1 for ${lines.join('. #1 for ')}.` : ''} All of them: ${link}`
  return { key: `rankings-${edition}`, text }
}

export interface AnnouncementBasis {
  /** `sec`: an 8-K filing. `confirmed`: two or more outlets. `unconfirmed`: one outlet, which is never posted. */
  basis: 'sec' | 'confirmed' | 'unconfirmed'
  /** Share of staff, when the story gave one. Not a headcount. */
  percent: number | null
}

/**
 * Reads how a layoff announcement was sourced from its `layoffType`. The text is written in several forms ("Reported by 2+
 * publishers", "Reported by 3 publishers", "... · reported by 2+ publishers", "Reported by 1 publisher (Reuters) — unconfirmed"),
 * so it reads the count of publishers, not one fixed phrase. Two or more publishers, or an SEC filing, counts as confirmed.
 */
export function announcementBasis(layoffType: string | null): AnnouncementBasis {
  const text = layoffType ?? ''
  const percent = /(\d+(?:\.\d+)?)% of staff/.exec(text)?.[1]
  const publishers = Number(/reported by (\d+)\+? publishers?/i.exec(text)?.[1] ?? 0)
  return {
    basis: /^SEC 8-K/.test(text) ? 'sec' : publishers >= 2 && !/unconfirmed/i.test(text) ? 'confirmed' : 'unconfirmed',
    percent: percent ? Number(percent) : null,
  }
}

/** A shutdown or closure is not "layoffs", so it is not posted by the automatic stream. */
export function isClosure(layoffType: string | null): boolean {
  return /shut(ting)?\s?down|closure|closing/i.test(layoffType ?? '')
}

export interface AnnouncementForPost {
  employer: string
  state: string | null
  workers: number | null
  percent: number | null
  basis: 'sec' | 'confirmed'
  /** /layoffs/company/<slug> */
  path: string
}

/**
 * A layoff the company announced (an SEC filing, or two or more outlets), as opposed to a WARN filing. It says who reported it
 * and nothing more, and a share of staff is never turned into a headcount. Single-outlet stories are not posted.
 */
export function announcementPostText(f: AnnouncementForPost, utm: string, shortLinks = true): string {
  const where = f.state ? ` in ${stateName(f.state)}` : ''
  const scale = f.workers ? `${n(f.workers)} workers${f.percent ? ` (${f.percent}% of staff)` : ''}` : f.percent ? `${f.percent}% of staff` : ''
  const link = `${SITE_URL}${f.path}?${utm}`
  const tail = ` What was reported and what to do if you are affected: ${link}`
  const head = (name: string) =>
    `${name} announced layoffs${where}${scale ? `, affecting ${scale}` : ''}, ${f.basis === 'sec' ? 'according to an SEC filing' : 'according to multiple news reports'}.`
  const budget = textBudget(link, shortLinks)
  const fit = (name: string) => head(name === f.employer ? name : `${name}…`) + tail
  let name = f.employer
  while (name.length > 12 && fit(name).length > budget) name = name.slice(0, -2).trimEnd()
  return fit(name)
}

export interface MonthPoint { year: number; month: number }

export interface JobsReportData {
  /** The month the report covers. */
  month: MonthPoint
  prevMonth: MonthPoint
  /** Change in total nonfarm payroll jobs from the month before, in people. */
  payrollChange: number
  /** Unemployment rate, percent, one decimal. */
  rate: number
  prevRate: number
}

export interface JoltsData {
  month: MonthPoint
  prevMonth: MonthPoint
  /** Job openings and layoffs and discharges, in people. */
  openings: number
  layoffs: number
  prevLayoffs: number
}

const monthName = (m: MonthPoint) => MONTH_NAMES[m.month - 1]
const monthKey = (m: MonthPoint) => `${m.year}-${String(m.month).padStart(2, '0')}`
const million = (people: number) => `${(people / 1_000_000).toFixed(1)} million`

/**
 * The BLS Employment Situation, posted once per month it covers. Always labeled all workers and all industries, since it is the
 * all-jobs frame and never the white-collar one. Only numbers BLS published.
 */
export function jobsReportPost(d: JobsReportData, utm: string, shortLinks = true): SocialPost {
  const link = `${SITE_URL}/layoffs?${utm}`
  // Both figures, the way BLS states them, and no "up" or "down": a month-to-month move in a survey estimate is often within its margin
  // of error, and BLS itself calls those "little changed".
  const jobs = d.payrollChange === 0 ? 'payroll employment unchanged' : `payroll employment ${d.payrollChange > 0 ? '+' : '-'}${n(Math.abs(d.payrollChange))} jobs`
  const rate = `${d.rate.toFixed(1)}% (${monthName(d.prevMonth)}: ${d.prevRate.toFixed(1)}%)`
  const text = `BLS jobs report for ${monthName(d.month)} ${d.month.year}: ${jobs}. The unemployment rate was ${rate}. All workers, all industries. Layoff notices set against this data: ${link}`
  if (text.length > textBudget(link, shortLinks)) {
    return { key: `bls-jobs-${monthKey(d.month)}`, text: `BLS jobs report, ${monthName(d.month)}: ${jobs}, unemployment rate ${rate}. All industries. ${link}` }
  }
  return { key: `bls-jobs-${monthKey(d.month)}`, text }
}

/** The BLS JOLTS release (job openings and layoffs), posted once per month it covers. All industries, labeled as such. */
export function joltsPost(d: JoltsData, utm: string, shortLinks = true): SocialPost {
  const link = `${SITE_URL}/layoffs?${utm}`
  const now = million(d.layoffs)
  const before = `${monthName(d.prevMonth)}: ${million(d.prevLayoffs)}`
  const text = `BLS JOLTS for ${monthName(d.month)} ${d.month.year}: ${million(d.openings)} job openings and ${now} layoffs and discharges (${before}). All industries. Compared with WARN layoff notices: ${link}`
  if (text.length > textBudget(link, shortLinks)) {
    return { key: `bls-jolts-${monthKey(d.month)}`, text: `BLS JOLTS, ${monthName(d.month)}: ${million(d.openings)} openings, ${now} layoffs (${before}). All industries. ${link}` }
  }
  return { key: `bls-jolts-${monthKey(d.month)}`, text }
}
